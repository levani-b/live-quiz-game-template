import { WebSocketServer, WebSocket } from "ws";
import { User, Game, Question, WSMessage } from "./types.js";
import { randomUUID } from "crypto";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// WebSocket server
const wss = new WebSocketServer({ port: PORT });

const users = new Map<string, User>();
const games = new Map<string, Game>();

const socketToUser = new Map<WebSocket, User>();

function send(ws: WebSocket, type: string, data: unknown) {
  const message: WSMessage = { type, data, id: 0 };
  ws.send(JSON.stringify(message));
}

function handleReg(ws: WebSocket, data: { name: string; password: string }) {
  const existing = [...users.values()].find((u) => u.name === data.name);

  if (existing) {
    if (existing.password !== data.password) {
      send(ws, "reg", {
        name: data.name,
        index: "",
        error: true,
        errorText: "Wrong password",
      });
      return;
    }
    existing.ws = ws;
    socketToUser.set(ws, existing);
    send(ws, "reg", {
      name: existing.name,
      index: existing.index,
      error: false,
      errorText: "",
    });
    return;
  }

  const index = crypto.randomUUID();
  const user: User = { name: data.name, password: data.password, index, ws };
  users.set(index, user);
  socketToUser.set(ws, user);

  send(ws, "reg", {
    name: user.name,
    index: user.index,
    error: false,
    errorText: "",
  });
}

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function handleCreateGame(ws: WebSocket, data: { questions: Question[] }) {
  const user = socketToUser.get(ws);
  if (!user) {
    send(ws, "error", { message: "Not registered" });
    return;
  }

  if (!data.questions || data.questions.length === 0) {
    send(ws, "error", { message: "No questions provided" });
    return;
  }

  const gameId = randomUUID();
  const code = generateCode();

  const game: Game = {
    id: gameId,
    code,
    hostId: user.index,
    questions: data.questions,
    players: [],
    currentQuestion: -1,
    status: "waiting",
    playerAnswers: new Map(),
  };

  games.set(gameId, game);

  send(ws, "game_created", {
    gameId,
    code,
  });

  console.log(`Game created: ${code} by ${user.name}`);
}

function handleJoinGame(ws: WebSocket, data: { code: string }) {
  const user = socketToUser.get(ws);
  if (!user) {
    send(ws, "error", { message: "Not registered" });
    return;
  }

  const game = [...games.values()].find((g) => g.code === data.code);
  if (!game) {
    send(ws, "error", { message: "Game not found" });
    return;
  }

  if (game.status !== "waiting") {
    send(ws, "error", { message: "Game already started" });
    return;
  }

  const alreadyJoined = game.players.find((p) => p.index === user.index);
  if (alreadyJoined) {
    alreadyJoined.ws = ws;
    send(ws, "game_joined", { gameId: game.id });
    return;
  }

  const player = {
    name: user.name,
    index: user.index,
    score: 0,
    ws,
  };

  game.players.push(player);

  send(ws, "game_joined", { gameId: game.id });

  broadcastToGame(game, "player_joined", {
    playerName: user.name,
    playerCount: game.players.length,
  });

  broadcastToGame(
    game,
    "update_players",
    game.players.map((p) => ({
      name: p.name,
      index: p.index,
      score: p.score,
    })),
  );

  console.log(`${user.name} joined game ${game.code}`);
}

function broadcastToGame(game: Game, type: string, data: unknown) {
  const host = [...users.values()].find((u) => u.index === game.hostId);
  if (host?.ws) send(host.ws, type, data);

  for (const player of game.players) {
    if (player.ws) send(player.ws, type, data);
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (raw) => {
    let message: WSMessage;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      console.error("Failed to parse message:", raw.toString());
      return;
    }

    const data =
      typeof message.data === "string"
        ? JSON.parse(message.data)
        : message.data;

    switch (message.type) {
      case "reg":
        handleReg(ws, data);
        break;
      case "create_game":
        handleCreateGame(ws, data);
        break;
      case "join_game":
        handleJoinGame(ws, data);
        break;
      case "start_game":
        console.log("start_game", data);
        break;
      case "answer":
        console.log("answer", data);
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
