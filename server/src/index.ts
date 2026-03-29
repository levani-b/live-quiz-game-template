import { WebSocketServer, WebSocket } from "ws";
import { User, Game, WSMessage } from "./types.js";

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
        console.log("reg", data);
        break;
      case "create_game":
        console.log("create_game", data);
        break;
      case "join_game":
        console.log("join_game", data);
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
