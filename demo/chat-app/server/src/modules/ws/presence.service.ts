import { redis } from "@/redis/client";
import { pubsub, PRESENCE_CHANNEL } from "@/redis/pubsub";

/**
 * Presence is tracked with a per-user connection counter in Redis rather
 * than an in-memory flag, because a user can have multiple tabs/devices
 * connected, possibly to *different* server instances. The counter is the
 * source of truth across the whole cluster:
 *   - connect  -> INCR presence:count:<userId>
 *   - disconnect -> DECR presence:count:<userId>
 * Only the 0 -> 1 and 1 -> 0 transitions trigger a presence:online /
 * presence:offline broadcast, so we don't spam events on every tab open/close.
 * A TTL heartbeat key backs this up in case a process crashes without
 * running its disconnect handler.
 */
const countKey = (userId: string) => `presence:count:${userId}`;
const heartbeatKey = (userId: string) => `presence:heartbeat:${userId}`;
const HEARTBEAT_TTL_SECONDS = 60;

export async function markOnline(userId: string) {
  const count = await redis.incr(countKey(userId));
  await redis.set(heartbeatKey(userId), Date.now(), "EX", HEARTBEAT_TTL_SECONDS);
  if (count === 1) {
    await pubsub.publish(PRESENCE_CHANNEL, { userId, status: "online" });
  }
}

export async function markOffline(userId: string) {
  const count = await redis.decr(countKey(userId));
  if (count <= 0) {
    await redis.del(countKey(userId));
    await redis.del(heartbeatKey(userId));
    await pubsub.publish(PRESENCE_CHANNEL, { userId, status: "offline" });
  }
}

export async function heartbeat(userId: string) {
  await redis.set(heartbeatKey(userId), Date.now(), "EX", HEARTBEAT_TTL_SECONDS);
}

export async function isOnline(userId: string) {
  const count = await redis.get(countKey(userId));
  return Number(count ?? 0) > 0;
}

export async function getOnlineStatuses(userIds: string[]) {
  if (userIds.length === 0) return {};
  const pipeline = redis.pipeline();
  userIds.forEach((id) => pipeline.get(countKey(id)));
  const results = await pipeline.exec();
  const statuses: Record<string, boolean> = {};
  userIds.forEach((id, i) => {
    const value = results?.[i]?.[1] as string | null;
    statuses[id] = Number(value ?? 0) > 0;
  });
  return statuses;
}
