import { Elysia, t } from "elysia";
import { prisma } from "@/db/client";
import { authGuard } from "@/middleware/auth.middleware";

export const userRoutes = new Elysia({ prefix: "/users" })
  .use(authGuard)
  .get(
    "/search",
    async ({ query, user }) => {
      if (!query.q || query.q.length < 2) return [];
      return prisma.user.findMany({
        where: {
          id: { not: user.id },
          OR: [
            { username: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ],
        },
        select: { id: true, username: true, avatarUrl: true },
        take: 20,
      });
    },
    { query: t.Object({ q: t.Optional(t.String()) }) }
  )
  .get("/me", ({ user }) => ({ id: user.id, email: user.email, username: user.username }));
