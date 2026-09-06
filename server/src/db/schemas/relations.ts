import { relations } from "drizzle-orm/_relations";
import { refreshTokens, users } from "./users";
import { conversationMembers, conversations } from "./conversations";
import { messages } from "./messages";
import { notifications } from "./notifications";

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(conversationMembers),
  sentMessages: many(messages),
  notifications: many(notifications),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
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

export const table = {
  users,
  conversations,
  conversationMembers,
  messages,
  notifications,
  refreshTokens,
} as const;

export type Table = typeof table;

export type TUser = typeof users.$inferSelect;
export type TConversation = typeof conversations.$inferSelect;
export type TConversationMember = typeof conversationMembers.$inferSelect;
export type TMessage = typeof messages.$inferSelect;
export type TNotification = typeof notifications.$inferSelect;

export type TInsertUser = typeof users.$inferInsert;
export type TInsertConversation = typeof conversations.$inferInsert;
export type TInsertConversationMember = typeof conversationMembers.$inferInsert;
export type TInsertMessage = typeof messages.$inferInsert;
export type TInsertNotification = typeof notifications.$inferInsert;
