import { BadRequestError } from "@/lib/customError";
import { conversationMembers, conversations, db, messages, users } from "@/db";
import { desc, eq, inArray } from "drizzle-orm";
import type { ConversationModel } from "./model";

export abstract class Conversation {
  static async createConversation(
    { participants }: ConversationModel["createConversationBody"],
    userId: string,
  ) {
    if (!Array.isArray(participants) || participants.length === 0) {
      throw new BadRequestError("Invalid participants list");
    }

    // Deduplicate and filter out the current user if included in body
    const uniqueParticipants = Array.from(new Set(participants)).filter(
      (id) => id !== userId,
    );

    if (uniqueParticipants.length === 0) {
      throw new BadRequestError(
        "Cannot create a conversation with only yourself",
      );
    }

    const isDirect = uniqueParticipants.length === 1;

    // 1. Direct Message (1-on-1): Check for an existing DM using dmHash
    if (isDirect) {
      const recipientId = uniqueParticipants[0];
      const dmHash = [userId, recipientId].sort().join(":");

      const existingConversation = await db
        .select()
        .from(conversations)
        .where(eq(conversations.dmHash, dmHash))
        .execute();
      console.log("existingConversation", existingConversation);

      if (existingConversation.length > 0) {
        return { conversation: existingConversation[0] };
      }

      // Create new DM inside a single transaction
      return await db.transaction(async (tx) => {
        const [newConv] = await tx
          .insert(conversations)
          .values({
            type: "direct",
            dmHash,
          })
          .returning();

        await tx.insert(conversationMembers).values([
          { conversationId: newConv.id, userId },
          { conversationId: newConv.id, userId: recipientId },
        ]);

        return { conversation: newConv };
      });
    }

    // 2. Group Conversation: Insert all participants at once
    return await db.transaction(async (tx) => {
      const [newConv] = await tx
        .insert(conversations)
        .values({
          type: "group",
        })
        .returning();

      const allMemberIds = [userId, ...uniqueParticipants];

      const memberRows = allMemberIds.map((memberId) => ({
        conversationId: newConv.id,
        userId: memberId,
        role: memberId === userId ? "admin" : "member",
      }));

      await tx.insert(conversationMembers).values(memberRows);

      return { conversation: newConv };
    });
  }

  static async getConversations(userId: string) {
    // 1. Fetch user's conversation IDs & member settings
    const memberships = await db
      .select({
        conversationId: conversationMembers.conversationId,
        unreadCount: conversationMembers.unreadCount,
        isMuted: conversationMembers.isMuted,
        isPinned: conversationMembers.isPinned,
        isArchived: conversationMembers.isArchived,
      })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId));

    if (memberships.length === 0) return [];

    const conversationIds = memberships.map((m) => m.conversationId);
    const settingsMap = new Map(memberships.map((m) => [m.conversationId, m]));

    // 2. SQL Join: Fetch Conversations, Messages, and Member Details in one query
    const rows = await db
      .select({
        conversation: conversations,
        latestMessage: messages,
        memberUser: {
          id: users.id,
          username: users.username,
          email: users.email,
        },
      })
      .from(conversations)
      .where(inArray(conversations.id, conversationIds))
      .leftJoin(messages, eq(conversations.lastMessageId, messages.id))
      .leftJoin(
        conversationMembers,
        eq(conversations.id, conversationMembers.conversationId),
      )
      .leftJoin(users, eq(conversationMembers.userId, users.id))
      .orderBy(
        desc(conversations.lastMessageAt),
        desc(conversations.createdAt),
      );

    // 3. Group flat SQL rows into clean conversation objects
    const conversationsMap = new Map<string, any>();

    for (const row of rows) {
      const convId = row.conversation.id;

      if (!conversationsMap.has(convId)) {
        const settings = settingsMap.get(convId);
        conversationsMap.set(convId, {
          id: row.conversation.id,
          type: row.conversation.type,
          title: row.conversation.title,
          iconUrl: row.conversation.iconUrl,
          lastMessageAt: row.conversation.lastMessageAt,
          metadata: row.conversation.metadata,
          latestMessage: row.latestMessage ?? null,
          unreadCount: settings?.unreadCount ?? 0,
          isMuted: settings?.isMuted ?? false,
          isPinned: settings?.isPinned ?? false,
          isArchived: settings?.isArchived ?? false,
          members: [],
        });
      }

      if (row.memberUser?.id) {
        const currentConv = conversationsMap.get(convId);
        if (
          !currentConv.members.some((m: any) => m.id === row.memberUser?.id)
        ) {
          currentConv.members.push(row.memberUser);
        }
      }
    }

    // 4. Transform dynamic Direct Message titles & return list
    return Array.from(conversationsMap.values()).map((conv) => {
      const isDirect = conv.type === "direct";
      const otherUser = conv.members.find((m: any) => m.id !== userId) ?? null;

      return {
        ...conv,
        title: isDirect ? (otherUser?.username ?? "Unknown User") : conv.title,
        iconUrl: isDirect ? null : conv.iconUrl,
        otherUser: isDirect ? otherUser : null,
      };
    });
  }
}
