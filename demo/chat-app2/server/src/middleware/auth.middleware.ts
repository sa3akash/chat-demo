import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { prisma } from "@/db/client";

/**
 * Resolves the current user from a Bearer token and makes it available as
 * `ctx.user` on any route/plugin that `.use()`s this. Throws a 401 via
 * `set.status` when the token is missing or invalid, rather than letting
 * routes each re-implement auth checks.
 */
export const authGuard = new Elysia({ name: "auth-guard" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    })
  )
  .derive({ as: "scoped" }, async ({ headers, jwt, set }) => {
    const authHeader = headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      set.status = 401;
      throw new Error("Missing auth token");
    }

    const payload = await jwt.verify(token);
    if (!payload || typeof payload.sub !== "string") {
      set.status = 401;
      throw new Error("Invalid auth token");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      set.status = 401;
      throw new Error("User not found");
    }

    return { user };
  });

/** Same idea, but for the WebSocket handshake where auth arrives as a query param. */
export async function verifyTokenFromQuery(token: string | undefined) {
  if (!token) return null;
  const { verifyJwt } = await import("./jwt-verify");
  return verifyJwt(token);
}
