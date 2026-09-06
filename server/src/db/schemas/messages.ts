import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { common } from "./utils";
import { messageTypeEnum } from "./enum";
import { users } from "./users";
import { conversations } from "./conversations";

// Messages Table
export const messages = pgTable(
  "messages",
  {
    ...common,
    conversationId: varchar("conversation_id", { length: 64 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    replyToId: varchar("reply_to_id", { length: 64 }),
    content: text("content"),
    type: messageTypeEnum("type").default("text").notNull(),

    // Rich Media & Metadata
    attachments: jsonb("attachments").default([]).notNull(), // [{ url, mimeType, size }]
    reactions: jsonb("reactions").default({}).notNull(), // { "👍": ["userId1", "userId2"] }

    isEdited: boolean("is_edited").default(false).notNull(),
    deletedForEveryone: boolean("deleted_for_everyone")
      .default(false)
      .notNull(),
  },
  (table) => [
    // Composite index: Instant loading of messages ordered by time within a chat
    index("msg_conv_created_idx").on(table.conversationId, table.createdAt),
  ],
);
