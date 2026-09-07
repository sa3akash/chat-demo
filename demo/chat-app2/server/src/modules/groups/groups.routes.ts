import { Elysia, t } from "elysia";
import { prisma } from "@/db/client";
import { authGuard } from "@/middleware/auth.middleware";

export const groupRoutes = new Elysia({ prefix: "/groups" })
  .use(authGuard)

  .post(
    "/",
    async ({ body, user }) => {
      const memberIds = [...new Set([user.id, ...body.memberIds])];
      return prisma.conversation.create({
        data: {
          type: "GROUP",
          name: body.name,
          members: {
            create: memberIds.map((id) => ({
              userId: id,
              role: id === user.id ? "OWNER" : "MEMBER",
            })),
          },
        },
        include: { members: { include: { user: { select: { id: true, username: true } } } } },
      });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        memberIds: t.Array(t.String(), { minItems: 1 }),
      }),
    }
  )

  .post(
    "/:id/members",
    async ({ params, body, user, set }) => {
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: params.id, userId: user.id } },
      });
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        set.status = 403;
        return { error: "Only owners/admins can add members" };
      }

      await prisma.conversationMember.createMany({
        data: body.userIds.map((id) => ({ conversationId: params.id, userId: id, role: "MEMBER" })),
        skipDuplicates: true,
      });
      return { ok: true };
    },
    { body: t.Object({ userIds: t.Array(t.String(), { minItems: 1 }) }) }
  )

  .delete("/:id/members/:userId", async ({ params, user, set }) => {
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: params.id, userId: user.id } },
    });
    const isSelf = params.userId === user.id;
    const canRemove = isSelf || membership?.role === "OWNER" || membership?.role === "ADMIN";
    if (!canRemove) {
      set.status = 403;
      return { error: "Not allowed" };
    }

    await prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId: params.id, userId: params.userId } },
    });
    return { ok: true };
  });
