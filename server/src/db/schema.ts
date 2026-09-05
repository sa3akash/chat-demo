import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const common = {
  id: varchar("id")
    .$defaultFn(() => createId())
    .primaryKey(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

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

// --- Tables ---
export const users = pgTable("users", {
  ...common,
  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  passwordHash: text("password_hash"),
  isVerified: boolean("is_verified").default(false).notNull(),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"),
  status: userStatusEnum("status").default("offline").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

export const conversations = pgTable("conversations", {
  ...common,
  type: conversationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }),
  iconUrl: text("icon_url"),
  lastMessageId: varchar("last_message_id", { length: 64 }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}),
});

export const conversationMembers = pgTable("conversation_members", {
  ...common,
  conversationId: varchar("conversation_id", { length: 64 })
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastReadAt: timestamp("last_read_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  isMuted: boolean("is_muted").default(false).notNull(),
});

export const messages = pgTable("messages", {
  ...common,
  conversationId: varchar("conversation_id", { length: 64 })
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id", { length: 64 })
    .notNull()
    .references(() => users.id),
  replyToId: varchar("reply_to_id", { length: 64 }),
  threadRootId: varchar("thread_root_id", { length: 64 }),
  content: text("content").notNull(),
  type: messageTypeEnum("type").default("text").notNull(),
  isEdited: boolean("is_edited").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  deletedForEveryone: boolean("deleted_for_everyone").default(false).notNull(),
  deletedForUserIds: jsonb("deleted_for_user_ids").default([]),
  metadata: jsonb("metadata").default({}),
});

export const notifications = pgTable("notifications", {
  ...common,
  userId: varchar("user_id", { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: varchar("actor_id", { length: 64 }).references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  link: text("link"),
  isRead: boolean("is_read").default(false).notNull(),
  metadata: jsonb("metadata").default({}),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(conversationMembers),
  sentMessages: many(messages),
  notifications: many(notifications),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  members: many(conversationMembers),
  messages: many(messages),
}));

export const conversationMembersRelations = relations(
  conversationMembers,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMembers.conversationId],
      references: [conversations.id],
    }),
    user: one(users, {
      fields: [conversationMembers.userId],
      references: [users.id],
    }),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
  }),
}));
