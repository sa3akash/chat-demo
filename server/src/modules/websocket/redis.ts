import Redis from "ioredis";
import { logger } from "@/lib/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const retryStrategy = (times: number) => Math.min(times * 100, 3000);

// Publisher client
export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy,
  lazyConnect: true,
});

// Subscriber client (cannot share the pub connection)
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy,
  lazyConnect: true,
});

redisClient.on("error", (err) =>
  logger.error({ err: err.message }, "Redis client error")
);
redisSub.on("error", (err) =>
  logger.error({ err: err.message }, "Redis subscriber error")
);

// ─────────────────────────────────────────────────────────────────────────────
// Typed publish helper — serialises the payload automatically
// ─────────────────────────────────────────────────────────────────────────────

export async function publishToChannel(
  channel: string,
  type: string,
  payload: unknown
): Promise<void> {
  await redisClient.publish(channel, JSON.stringify({ type, payload }));
}

/** Publish to a specific conversation room */
export const publishToConversation = (
  conversationId: string,
  type: string,
  payload: unknown
) => publishToChannel(`channel:conversation:${conversationId}`, type, payload);

/** Publish to a specific user's personal channel */
export const publishToUser = (
  userId: string,
  type: string,
  payload: unknown
) => publishToChannel(`channel:user:${userId}`, type, payload);

/** Publish to the global presence channel */
export const publishPresence = (type: string, payload: unknown) =>
  publishToChannel("channel:presence", type, payload);

// ─────────────────────────────────────────────────────────────────────────────
// Presence helpers
// ─────────────────────────────────────────────────────────────────────────────

const PRESENCE_TTL = 45; // seconds

export async function setUserOnline(userId: string): Promise<void> {
  await Promise.all([
    redisClient.set(`presence:${userId}`, 1, "EX", PRESENCE_TTL),
    redisClient.sadd("presence:online_set", userId),
  ]);
}

export async function refreshPresence(userId: string): Promise<void> {
  await redisClient.set(`presence:${userId}`, 1, "EX", PRESENCE_TTL);
  await redisClient.sadd("presence:online_set", userId);
}

export async function setUserOffline(userId: string): Promise<void> {
  await redisClient.del(`presence:${userId}`);
  await redisClient.srem("presence:online_set", userId);
}

export async function getAllOnlineUsers(): Promise<string[]> {
  return redisClient.smembers("presence:online_set");
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis Pub/Sub initialisation — call once at startup
// ─────────────────────────────────────────────────────────────────────────────

let gatewayServerRef: { publish?: (topic: string, data: string) => void } | null = null;

export function setGatewayServer(
  server: { publish?: (topic: string, data: string) => void }
): void {
  gatewayServerRef = server;
  logger.info("Gateway server registered for uWS pub/sub");
}

export async function initRedis(): Promise<void> {
  try {
    await Promise.all([redisClient.connect(), redisSub.connect()]);
    logger.info("Redis clients connected");

    // Fan-out: forward every Redis channel message to uWS native pub/sub
    await redisSub.psubscribe("channel:*");
    logger.info("Subscribed to Redis pattern channel:*");

    redisSub.on("pmessage", (_pattern, channel, rawMessage) => {
      const topic = channel.replace(/^channel:/, "");
      gatewayServerRef?.publish?.(topic, rawMessage);
    });
  } catch (err: any) {
    logger.error({ err: err.message }, "Failed to initialise Redis pub/sub");
  }
}
