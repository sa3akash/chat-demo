import { BadRequestError, AppError } from "@/lib/customError";
import { conversationMembers, conversations, db, messages, users } from "@/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
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
          title: `Group Chat`,
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
        title: isDirect ? (otherUser?.username ?? "Unknown User") : (conv.title ?? "Group Chat"),
        iconUrl: isDirect ? null : conv.iconUrl,
        otherUser: isDirect ? otherUser : null,
      };
    });
  }

  static async getOthersUser(conversationId: string, userId: string) {
    // fetch conversation members
    const members = await db
      .select({
        userId: conversationMembers.userId,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
        },
      })
      .from(conversationMembers)
      .leftJoin(users, eq(conversationMembers.userId, users.id))
      .where(eq(conversationMembers.conversationId, conversationId))
      .execute();

    // filter out the current user
    const otherUser = members.find((m) => m.userId !== userId);

    if (!otherUser) {
      throw new BadRequestError("User not found");
    }

    return {
      id: otherUser.userId,
      username: otherUser.user?.username!,
      email: otherUser.user?.email!,
    };
  }

  /** Get full group conversation details including all members with their roles */
  static async getGroupDetails(conversationId: string, userId: string) {
    const conv = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conv.length) throw new BadRequestError("Conversation not found");
    if (conv[0].type !== "group") throw new BadRequestError("Not a group conversation");

    // Verify requester is a member
    const myMembership = await db
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId)
        )
      )
      .limit(1);

    if (!myMembership.length) throw new AppError("Not a member of this conversation", 403);

    // Fetch all members with user info
    const memberRows = await db
      .select({
        userId: conversationMembers.userId,
        role: conversationMembers.role,
        joinedAt: conversationMembers.createdAt,
        id: users.id,
        username: users.username,
        email: users.email,
      })
      .from(conversationMembers)
      .leftJoin(users, eq(conversationMembers.userId, users.id))
      .where(eq(conversationMembers.conversationId, conversationId));

    return {
      id: conv[0].id,
      title: conv[0].title ?? "Group Chat",
      iconUrl: conv[0].iconUrl,
      createdAt: conv[0].createdAt,
      myRole: myMembership[0].role,
      members: memberRows.map((m) => ({
        id: m.id!,
        username: m.username!,
        email: m.email!,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  /** Update group name / icon (admin only) */
  static async updateGroup(
    conversationId: string,
    userId: string,
    data: { title?: string; iconUrl?: string }
  ) {
    const myMembership = await db
      .select({ role: conversationMembers.role })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId)
        )
      )
      .limit(1);

    if (!myMembership.length) throw new AppError("Not a member", 403);
    if (myMembership[0].role !== "admin") throw new AppError("Admin only", 403);

    const [updated] = await db
      .update(conversations)
      .set({
        ...(data.title !== undefined && { title: data.title }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
      })
      .where(eq(conversations.id, conversationId))
      .returning();

    return updated;
  }

  /** Add members to a group (admin only) */
  static async addMembers(
    conversationId: string,
    userId: string,
    newMemberIds: string[]
  ) {
    const myMembership = await db
      .select({ role: conversationMembers.role })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId)
        )
      )
      .limit(1);

    if (!myMembership.length) throw new AppError("Not a member", 403);
    if (myMembership[0].role !== "admin") throw new AppError("Admin only", 403);

    // Skip existing members
    const existing = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          inArray(conversationMembers.userId, newMemberIds)
        )
      );

    const existingIds = new Set(existing.map((e) => e.userId));
    const toAdd = newMemberIds.filter((id) => !existingIds.has(id));

    if (toAdd.length === 0) return { added: [] };

    await db.insert(conversationMembers).values(
      toAdd.map((memberId) => ({
        conversationId,
        userId: memberId,
        role: "member",
      }))
    );

    // Return the newly added user info
    const addedUsers = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(inArray(users.id, toAdd));

    return { added: addedUsers };
  }

  /** Remove a member from a group (admin only, or self-remove) */
  static async removeMember(
    conversationId: string,
    requesterId: string,
    targetUserId: string
  ) {
    const myMembership = await db
      .select({ role: conversationMembers.role })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, requesterId)
        )
      )
      .limit(1);

    if (!myMembership.length) throw new AppError("Not a member", 403);

    // Can only remove others if admin, or removing self
    if (requesterId !== targetUserId && myMembership[0].role !== "admin") {
      throw new AppError("Admin only", 403);
    }

    await db
      .delete(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, targetUserId)
        )
      );

    return { removed: targetUserId };
  }
}
