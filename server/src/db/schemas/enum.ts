import { pgEnum } from "drizzle-orm/pg-core";

// --- Enums ---
export const userStatusEnum = pgEnum("user_status", [
  "online",
  "offline",
  "away",
  "dnd",
]);

export const conversationTypeEnum = pgEnum("conversation_type", [
  "direct",
  "group",
  "channel",
  "community",
  "secret",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "poll",
  "system",
  "encrypted",
]);