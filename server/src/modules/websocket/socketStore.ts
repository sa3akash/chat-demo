import Redis from "ioredis";
import type { Elysia } from "elysia";
import { MessageSchema } from "./types";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

export const pub = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export const sub = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

pub.on("error", (err) => {
  logger.error({ err }, "Redis Pub Error");
});

sub.on("error", (err) => {
  logger.error({ err }, "Redis Sub Error");
});

// Auto-connect redis
Promise.all([pub.connect().catch(() => {}), sub.connect().catch(() => {})]).then(
  () => {
    sub.subscribe("chat", (err) => {
      if (err) logger.error({ err }, "Redis subscription failed");
      else logger.info("Redis sub listening on channel: chat");
    });
  },
);

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

    try {
      if (pub.status === "ready") {
        await pub.sadd("presence:online", userId);
      }
      // Update database status
      await db
        .update(users)
        .set({ status: "online", lastSeenAt: new Date() })
        .where(eq(users.id, userId));
    } catch (e) {
      logger.error({ err: e }, "Failed to update user online status");
    }

    // Broadcast presence update
    const presenceMsg: MessageSchema = {
      type: "presence",
      payload: {
        userId,
        status: "online",
        lastSeen: Date.now(),
      },
    };

    if (pub.status === "ready") {
      await pub.publish(
        "chat",
        JSON.stringify({
          targetUserId: "*",
          message: presenceMsg,
        }),
      );
    } else {
      broadcastToAllLocal(presenceMsg);
    }
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

    try {
      if (pub.status === "ready") {
        await pub.srem("presence:online", userId);
      }
      // Update database status
      await db
        .update(users)
        .set({ status: "offline", lastSeenAt: new Date() })
        .where(eq(users.id, userId));
    } catch (e) {
      logger.error({ err: e }, "Failed to update user offline status");
    }

    const presenceMsg: MessageSchema = {
      type: "presence",
      payload: {
        userId,
        status: "offline",
        lastSeen: Date.now(),
      },
    };

    if (pub.status === "ready") {
      await pub.publish(
        "chat",
        JSON.stringify({
          targetUserId: "*",
          message: presenceMsg,
        }),
      );
    } else {
      broadcastToAllLocal(presenceMsg);
    }
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

// --- Redis Pub/Sub Cluster Subscriber Listener ---
sub.on("message", (channel, payloadStr) => {
  if (channel !== "chat") return;

  try {
    const { targetUserId, message, excludeSocketId } = JSON.parse(
      payloadStr,
    ) as {
      targetUserId: string;
      message: MessageSchema;
      excludeSocketId?: string;
    };

    if (targetUserId === "*") {
      broadcastToAllLocal(message);
    } else {
      broadcastToLocalUser(targetUserId, message, excludeSocketId);
    }
  } catch (err) {
    logger.error({ err }, "Failed parsing pub/sub message payload");
  }
});