// Service handles business logic, decoupled from Elysia controller
import { status } from "elysia";

import type { ConversationModel } from "./model";
import { BadRequestError } from "@/middlewares/error";
import { conversationMembers, conversations, db, messages, users } from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

// If a class doesn't need to store a property,
// you can use an `abstract class` to avoid class allocation
export abstract class Conversation {
  static async createConversation(
    { participants }: ConversationModel["createConversationBody"],
    userId: string,
  ) {
    if (!Array.isArray(participants) || participants.length === 0) {
      throw new BadRequestError("Invalid participants");
    }

    // create conversation
    const conversation = await db
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.userId, participants[0]),
          eq(conversationMembers.userId, userId),
        ),
      )
      .execute();

    // if conversation already exist
    if (conversation.length > 0) {
      // find conversation
      const existConversation = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversation[0].conversationId))
        .execute();

      return {
        conversation: existConversation[0],
      };
    }

    // create conversation
    const createConversation = await db
      .insert(conversations)
      .values({
        type: participants.length > 1 ? "group" : "direct",
      })
      .returning();

    // add participants to conversation
    await db.insert(conversationMembers).values({
      conversationId: createConversation[0].id,
      userId: participants[0],
    });
    await db.insert(conversationMembers).values({
      conversationId: createConversation[0].id,
      userId: userId,
    });

    return {
      conversation: createConversation[0],
    };
  }



static async getConversations(userId: string) {
  // ১. Relational Query দিয়ে Conversation + Member + User ডাটা একবারে আনা
  const userMemberships = await db.query.conversationMembers.findMany({
    where: (cm, { eq }) => eq(cm.userId, userId),
    with: {
      conversation: {
        with: {
          members: {
            with: {
              user: {
                columns: {
                  id: true,
                  username: true,
                  email: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (userMemberships.length === 0) return [];

  // ২. সুন্দর ফরমেটে রেসপন্স সাজানো
  return userMemberships.map((membership) => {
    const conv = membership.conversation;
    const isDirect = conv.type === "direct";

    // Direct message-এর ক্ষেত্রে অপর ইউজারকে আলাদা করা
    const otherMember = conv.members.find((m) => m.userId !== userId);
    const otherUser = otherMember?.user ?? null;

    return {
      id: conv.id,
      type: conv.type,
      // Direct message হলে টাইটেল হবে অপর ইউজারের ইউজারনেম
      title: isDirect ? (otherUser?.username ?? "Unknown User") : conv.title,
      iconUrl: conv.iconUrl,
      lastMessageAt: conv.lastMessageAt,
      metadata: conv.metadata,
      unreadCount: membership.unreadCount,
      isMuted: membership.isMuted,
      isPinned: membership.isPinned,
      isArchived: membership.isArchived,
      otherUser: isDirect ? otherUser : null,
    };
  });
}

}
