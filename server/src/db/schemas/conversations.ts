import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { common } from "./utils";
import { conversationTypeEnum, messageTypeEnum } from "./enum";
import { users } from "./users";


// Conversations Table
export const conversations = pgTable("conversations", {
  ...common,
  type: conversationTypeEnum("type").default("direct").notNull(),
  title: varchar("title", { length: 255 }),
  iconUrl: text("icon_url"),

  // Direct Message hash prevents duplicate DM rooms between the same two users
  // Format for DMs: "userA_id:userB_id" (sorted alphabetically)
  dmHash: varchar("dm_hash", { length: 128 }).unique(),

  lastMessageId: varchar("last_message_id", { length: 64 }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}),
});

export const conversationMembers = pgTable(
  "conversation_members",
  {
    ...common,
    conversationId: varchar("conversation_id", { length: 64 })
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).default("member").notNull(),

    // Unread tracking & Notifications
    lastReadMessageId: varchar("last_read_message_id", { length: 64 }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    unreadCount: integer("unread_count").default(0).notNull(),

    isMuted: boolean("is_muted").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
  },
  (table) => [
    // Indexes to instantly locate a user's active chats
    index("cm_user_id_idx").on(table.userId),
    uniqueIndex("cm_user_conv_unique").on(table.conversationId, table.userId),
  ],
);

