import type { Elysia } from "elysia";
import { MessageSchema, PresenceStatus } from "./types";
import { logger } from "@/lib/logger";

// Extract Elysia internal WS type
export type WS = Parameters<
  NonNullable<Parameters<Elysia["ws"]>[1]["open"]>
>[0];

// In-memory socket store (Local to this node)
export const userSockets = new Map<string, Set<WS>>();

/**
 * Add local connection, update DB & broadcast presence
 */
export async function addUser(userId: string, ws: WS) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.add(ws);
  } else {
    userSockets.set(userId, new Set([ws]));

    ws.subscribe(`user:${userId}`);

    const presenceMsg: MessageSchema = {
      type: "presence",
      payload: {
        userId,
        status: "online",
        lastSeen: Date.now(),
      },
    };

    broadcastToAllLocal(presenceMsg);
  }
}

/**
 * Remove connection & cleanup presence on disconnect
 */
export async function disconnectUser(userId: string, ws: WS) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  sockets.delete(ws);
  if (sockets.size === 0) {
    userSockets.delete(userId);
    ws.unsubscribe(`user:${userId}`);

    const presenceMsg: MessageSchema = {
      type: "presence",
      payload: {
        userId,
        status: "offline",
        lastSeen: Date.now(),
      },
    };

    broadcastToAllLocal(presenceMsg);
  }
}

/**
 * Direct delivery to local sockets attached to this instance node
 */
export function broadcastToLocalUser(
  userId: string,
  message: MessageSchema,
  excludeSocketId?: string,
) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    const payloadStr = JSON.stringify(message);
    sockets.forEach((socket) => {
      if (socket.readyState === 1 && socket.id !== excludeSocketId) {
        socket.send(payloadStr);
      }
    });
  }
}

/**
 * Broadcast locally to all sockets connected to this instance node
 */
export function broadcastToAllLocal(message: MessageSchema) {
  const payloadStr = JSON.stringify(message);
  userSockets.forEach((sockets) => {
    sockets.forEach((socket) => {
      if (socket.readyState === 1) {
        socket.send(payloadStr);
      }
    });
  });
}