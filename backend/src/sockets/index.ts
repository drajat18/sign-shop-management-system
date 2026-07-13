import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | undefined;

export function initSockets(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN },
  });
  return io;
}

// Front desk and production emit/listen on these events to stay in sync
// without either side polling the API.
export function getIO(): SocketIOServer {
  if (!io) throw new Error("Sockets not initialized — call initSockets first");
  return io;
}

export const EVENTS = {
  ORDER_UPDATED: "order:updated",
  ORDER_CREATED: "order:created",
  JOB_UPDATED: "job:updated",
  JOB_CREATED: "job:created",
} as const;
