import { publishToConversation } from "../redis";
import type { TTypingUpdate, S2C_TypingUpdate } from "../types";
import type { WsContext } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// typing:update handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ephemeral — no DB write. Just fan-out to the conversation room.
 */
export async function handleTypingUpdate(
  ctx: WsContext,
  payload: TTypingUpdate
): Promise<void> {
  const { conversationId, isTyping } = payload;
  if (!conversationId) return;

  const typingPayload: S2C_TypingUpdate = {
    conversationId,
    userId: ctx.senderId,
    username: ctx.username,
    isTyping: !!isTyping,
  };

  await publishToConversation(conversationId, "typing:update", typingPayload);
}
