import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import type { AuthPayload } from "../middleware/auth.js";

let io: SocketIOServer | undefined;

export function initSockets(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN },
  });

  // Every client joins a room scoped to its own shop so real-time events
  // never cross tenant boundaries — without this, a browser connected for
  // one shop would see every other shop's live order/job updates too.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing token"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      socket.join(`shop:${payload.shopId}`);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Sockets not initialized — call initSockets first");
  return io;
}

export function emitToShop(shopId: string, event: string, payload: unknown): void {
  getIO().to(`shop:${shopId}`).emit(event, payload);
}

export const EVENTS = {
  ORDER_UPDATED: "order:updated",
  ORDER_CREATED: "order:created",
  JOB_UPDATED: "job:updated",
  JOB_CREATED: "job:created",
  ORDER_MESSAGE_CREATED: "order:message-created",
} as const;
