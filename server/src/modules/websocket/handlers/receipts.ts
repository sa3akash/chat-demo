import { db, conversationMembers } from "@/db";
import { and, eq } from "drizzle-orm";
import { publishToConversation, publishToUser } from "../redis";
import type { TReceiptRead, S2C_ReceiptRead, S2C_ConversationUpdate } from "../types";
import type { WsContext } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// receipt:read handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleReceiptRead(
  ctx: WsContext,
  payload: TReceiptRead
): Promise<void> {
  const { conversationId, messageId } = payload;
  if (!conversationId) return;

  // Mark the sender's unread count as zero in DB
  await db
    .update(conversationMembers)
    .set({
      unreadCount: 0,
      lastReadMessageId: messageId ?? null,
      lastReadAt: new Date(),
    })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, ctx.senderId)
      )
    );

  // Broadcast the read receipt to conversation participants
  const readPayload: S2C_ReceiptRead = {
    conversationId,
    userId: ctx.senderId,
    messageId,
    readAt: new Date().toISOString(),
  };
  await publishToConversation(conversationId, "receipt:read", readPayload);

  // Clear unread badge in the sender's own sidebar
  const sidebarClear: S2C_ConversationUpdate = { conversationId, unreadCount: 0 };
  await publishToUser(ctx.senderId, "conversation:update", sidebarClear);
}
