// Service handles business logic, decoupled from Elysia controller
import { status } from "elysia";

import type { MessageSchema } from "./model";
import { conversations, db, messages, users } from "@/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { BadRequestError } from "@/middlewares/error";

// If a class doesn't need to store a property,
// you can use an `abstract class` to avoid class allocation
export abstract class Message {
  static async sendMessage(
    { conversationId, content, type }: MessageSchema["sendMessageBody"],
    senderId: string,
  ) {
    const conversationExists = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .execute();

    if (conversationExists.length === 0) {
      throw new BadRequestError("Invalid conversation id");
    }

    const message = await db
      .insert(messages)
      .values({
        conversationId,
        content: content as string,
        type: type || ("text" as any),
        senderId: senderId,
      })
      .returning();

    return message[0];
  }

static async getMessagesByConversation({
  conversationId,
  cursor,
  limit = 20,
}: MessageSchema['getMessagesByConversationQuery']):Promise<MessageSchema['getMessagesByConversationResponse']> {
  const fetchLimit = limit + 1;
  const conditions = [eq(messages.conversationId, conversationId)];

  if (cursor) {
    conditions.push(lt(messages.createdAt, new Date(cursor)));
  }

  const rawRows = await db
    .select({
      id: messages.id,
      createdAt: messages.createdAt,
      updatedAt: messages.updatedAt,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      content: messages.content,
      type: messages.type,
      attachments: messages.attachments,
      // Select raw user columns separately
      userId: users.id,
      username: users.username,
      email: users.email,
    })
    .from(messages)
    .leftJoin(users, eq(messages.senderId, users.id))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(fetchLimit);

  let nextCursor: string | null = null;

  if (rawRows.length > limit) {
    const nextItem = rawRows.pop();
    nextCursor = nextItem?.createdAt.toISOString() ?? null;
  }

  // Format each row to nest the sender object
  const formattedMessages = rawRows.map((row) => {
    const { userId, username, email, ...messageData } = row;

    return {
      ...messageData,
      sender: userId
        ? {
            id: userId,
            username: username,
            email: email,
          }
        : null,
    };
  });

  return {
    messages: formattedMessages as unknown as MessageSchema['getMessagesByConversationResponse']['messages'],
    nextCursor,
  };
}
}
