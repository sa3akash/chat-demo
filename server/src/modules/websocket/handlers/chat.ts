import { db, messages, conversations, conversationMembers } from "@/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { publishToConversation, publishToUser } from "../redis";
import { sendError, sendFrame, type WsContext } from "./context";
import type { TChatSend, S2C_ChatNew, S2C_ChatAck, S2C_ConversationUpdate } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// chat:send handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleChatSend(
  ctx: WsContext,
  payload: TChatSend
): Promise<void> {
  const { ws, senderId, username } = ctx;
  const {
    conversationId,
    content,
    type: msgType = "text",
    tempId,
    replyToId,
    attachments = [],
  } = payload;

  if (!conversationId || !content) {
    sendError(ws, "INVALID_PAYLOAD", "conversationId and content are required");
    return;
  }

  // A. Persist message
  const [newMessage] = await db
    .insert(messages)
    .values({
      conversationId,
      content,
      type: msgType as any,
      senderId,
      replyToId: replyToId ?? null,
      attachments: attachments as any,
    })
    .returning();

  // B. Update conversation last-message pointer
  await db
    .update(conversations)
    .set({ lastMessageAt: newMessage.createdAt, lastMessageId: newMessage.id })
    .where(eq(conversations.id, conversationId));

  // C. Increment unread count for every participant except sender
  await db
    .update(conversationMembers)
    .set({ unreadCount: sql`${conversationMembers.unreadCount} + 1` })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        ne(conversationMembers.userId, senderId)
      )
    );

  // D. Build the full broadcast payload
  const chatPayload: S2C_ChatNew = {
    id: newMessage.id,
    tempId,
    conversationId,
    content: newMessage.content ?? "",
    type: newMessage.type,
    senderId,
    sender: { id: senderId, username },
    replyToId: newMessage.replyToId,
    attachments: (newMessage.attachments as any) ?? [],
    reactions: (newMessage.reactions as Record<string, string[]>) ?? {},
    createdAt: newMessage.createdAt.toISOString(),
  };

  // E. Broadcast to conversation room
  await publishToConversation(conversationId, "chat:new", chatPayload);

  // F. Ack to the sender
  const ack: S2C_ChatAck = {
    tempId,
    messageId: newMessage.id,
    conversationId,
    createdAt: newMessage.createdAt.toISOString(),
  };
  sendFrame(ws, "chat:ack", ack);

  // G. Sidebar updates for all conversation members
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));

  const sidebarUpdate: S2C_ConversationUpdate = {
    conversationId,
    latestMessage: chatPayload,
    lastMessageAt: newMessage.createdAt.toISOString(),
  };

  await Promise.all(
    members.map((m) => publishToUser(m.userId, "conversation:update", sidebarUpdate))
  );
}
