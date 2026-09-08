import { db, messages } from "@/db";
import { eq } from "drizzle-orm";
import { publishToConversation } from "../redis";
import type { TReactionUpdate, S2C_ReactionUpdate } from "../types";
import type { WsContext } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// reaction:update handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleReactionUpdate(
  ctx: WsContext,
  payload: TReactionUpdate
): Promise<void> {
  const { conversationId, messageId, emoji } = payload;
  if (!conversationId || !messageId || !emoji) return;

  const [targetMsg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));

  if (!targetMsg) return;

  // Toggle the sender's reaction (add if absent, remove if present)
  const currentReactions = (targetMsg.reactions as Record<string, string[]>) ?? {};
  const userSet = new Set(currentReactions[emoji] ?? []);

  if (userSet.has(ctx.senderId)) {
    userSet.delete(ctx.senderId);
    if (userSet.size === 0) {
      delete currentReactions[emoji];
    } else {
      currentReactions[emoji] = Array.from(userSet);
    }
  } else {
    userSet.add(ctx.senderId);
    currentReactions[emoji] = Array.from(userSet);
  }

  await db
    .update(messages)
    .set({ reactions: currentReactions })
    .where(eq(messages.id, messageId));

  const reactionPayload: S2C_ReactionUpdate = {
    conversationId,
    messageId,
    reactions: currentReactions,
    userId: ctx.senderId,
    emoji,
  };
  await publishToConversation(conversationId, "reaction:update", reactionPayload);
}
