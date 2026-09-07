import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// Separate connections for pub, sub, and general commands.
// A Redis connection in subscribe mode can't run other commands, so it needs
// its own dedicated client. Keeping "pub" and general "redis" separate too
// avoids head-of-line blocking under heavy publish load.
export const redis = new Redis(REDIS_URL);
export const pub = new Redis(REDIS_URL);
export const sub = new Redis(REDIS_URL);

redis.on("error", (err) => console.error("[redis] error", err));
pub.on("error", (err) => console.error("[redis:pub] error", err));
sub.on("error", (err) => console.error("[redis:sub] error", err));
