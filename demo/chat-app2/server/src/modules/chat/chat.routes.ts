import { Elysia, t } from "elysia";
import { prisma } from "@/db/client";
import { authGuard } from "@/middleware/auth.middleware";
import { getOnlineStatuses } from "@/modules/ws/presence.service";

export const chatRoutes = new Elysia({ prefix: "/conversations" })
  .use(authGuard)

  // List the current user's conversations, newest activity first, with
  // last message preview + other members' online status for the sidebar.
  .get("/", async ({ user }) => {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: user.id },
      include: {
        conversation: {
          include: {
            members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const otherUserIds = memberships.flatMap((m) =>
      m.conversation.members.filter((mem) => mem.userId !== user.id).map((mem) => mem.userId)
    );
    const onlineStatuses = await getOnlineStatuses([...new Set(otherUserIds)]);

    return memberships.map((m) => ({
      id: m.conversation.id,
      type: m.conversation.type,
      name: m.conversation.name,
      avatarUrl: m.conversation.avatarUrl,
      updatedAt: m.conversation.updatedAt,
      lastMessage: m.conversation.messages[0] ?? null,
      members: m.conversation.members.map((mem) => ({
        id: mem.user.id,
        username: mem.user.username,
        avatarUrl: mem.user.avatarUrl,
        online: onlineStatuses[mem.user.id] ?? false,
      })),
    }));
  })

  // Cursor-paginated message history (cursor = last seen message id).
  .get(
    "/:id/messages",
    async ({ params, query, user, set }) => {
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: params.id, userId: user.id } },
      });
      if (!membership) {
        set.status = 403;
        return { error: "Not a member of this conversation" };
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: params.id },
        include: {
          sender: { select: { id: true, username: true, avatarUrl: true } },
          reactions: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      return { messages: messages.reverse(), nextCursor: messages.length === 30 ? messages[0]?.id : null };
    },
    { query: t.Object({ cursor: t.Optional(t.String()) }) }
  )

  // Start (or reuse) a direct conversation with another user.
  .post(
    "/direct",
    async ({ body, user }) => {
      const existing = await prisma.conversation.findFirst({
        where: {
          type: "DIRECT",
          AND: [
            { members: { some: { userId: user.id } } },
            { members: { some: { userId: body.targetUserId } } },
          ],
        },
      });
      if (existing) return existing;

      return prisma.conversation.create({
        data: {
          type: "DIRECT",
          members: { create: [{ userId: user.id, role: "MEMBER" }, { userId: body.targetUserId, role: "MEMBER" }] },
        },
      });
    },
    { body: t.Object({ targetUserId: t.String() }) }
  );
