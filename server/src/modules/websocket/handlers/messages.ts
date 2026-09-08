import { db, messages } from "@/db";
import { eq } from "drizzle-orm";
import { publishToConversation } from "../redis";
import type { TMessageDelete, S2C_MessageDelete } from "../types";
import type { WsContext } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// message:delete handler
// ─────────────────────────────────────────────────────────────────────────────

export async function handleMessageDelete(
  ctx: WsContext,
  payload: TMessageDelete
): Promise<void> {
  const { conversationId, messageId } = payload;
  if (!conversationId || !messageId) return;

  const [targetMsg] = await db
    .select()
    .from(messages)
    .where(eq(messages.id, messageId));

  // Only the original sender may delete
  if (!targetMsg || targetMsg.senderId !== ctx.senderId) return;

  await db
    .update(messages)
    .set({ deletedForEveryone: true, content: "This message was deleted" })
    .where(eq(messages.id, messageId));

  const deletePayload: S2C_MessageDelete = { conversationId, messageId };
  await publishToConversation(conversationId, "message:delete", deletePayload);
}
