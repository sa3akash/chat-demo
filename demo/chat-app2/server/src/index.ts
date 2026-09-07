import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authRoutes } from "./modules/auth/auth.routes";
import { userRoutes } from "./modules/users/users.routes";
import { chatRoutes } from "./modules/chat/chat.routes";
import { groupRoutes } from "./modules/groups/groups.routes";
import { wsGateway } from "./modules/ws/ws.gateway";

const app = new Elysia()
  .use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
      credentials: true,
    })
  )
  .get("/health", () => ({ status: "ok", time: new Date().toISOString() }))
  .use(authRoutes)
  .use(userRoutes)
  .use(chatRoutes)
  .use(groupRoutes)
  .use(wsGateway)
  .listen(process.env.PORT ?? 4000);

console.log(
  `🦊 chat-server running at http://${app.server?.hostname}:${app.server?.port}  (ws at /ws)`
);

// Notes on scaling this horizontally:
// - Run N instances of this process behind a load balancer with WebSocket
//   support (no sticky sessions required — Redis pub/sub makes any node
//   able to deliver to any connected client).
// - Point them all at the same Postgres + Redis.
// - Put Postgres behind a connection pooler (e.g. PgBouncer) once instance
//   count grows, since each Bun process holds its own Prisma pool.
// - For very high fan-out (huge groups), consider batching presence
//   broadcasts and moving conversation membership lookups in ws.gateway.ts
//   into a Redis-cached set instead of hitting Postgres per message.
