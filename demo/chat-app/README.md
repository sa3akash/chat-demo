# Realtime Chat App — ElysiaJS + Next.js

Scalable chat with 1:1 messaging, groups, live presence, and typing indicators.

## Stack
- **Server:** ElysiaJS (Bun), native WebSockets, Prisma + PostgreSQL, Redis (pub/sub + presence)
- **Client:** Next.js App Router, Zustand, Tailwind

## Why it scales horizontally
Every server instance holds only its *local* WebSocket connections in memory.
Cross-instance delivery goes through Redis:
- **Messages:** published to `conv:<conversationId>`; every instance with a
  subscribed member relays to its local sockets.
- **Presence:** a Redis counter per user (`presence:count:<userId>`) tracks
  connections across *all* instances/tabs; only 0→1 and 1→0 transitions fire
  a broadcast, so presence stays correct even with multiple tabs/devices.

This means you can run N instances behind any load balancer with WS support —
**no sticky sessions needed**.

## Setup

### 1. Server
```bash
cd server
cp .env.example .env        # fill in DATABASE_URL / REDIS_URL / JWT_SECRET
bun install
bunx prisma migrate dev --name init
bun run dev                 # http://localhost:4000, ws at /ws
```
Needs a local Postgres and Redis — e.g. `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres` and `docker run -p 6379:6379 redis`.

### 2. Client
```bash
cd client
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

## API surface
- `POST /auth/register`, `POST /auth/login`
- `GET /conversations`, `GET /conversations/:id/messages?cursor=`
- `POST /conversations/direct` — start/reuse a 1:1 chat
- `POST /groups`, `POST /groups/:id/members`, `DELETE /groups/:id/members/:userId`
- `GET /users/search?q=`
- `WS /ws?token=<jwt>` — events: `message:send`, `typing:start/stop`,
  `conversation:join`, `presence:ping` in; `message:new`, `message:ack`,
  `presence:update`, `typing:update` out

## What's intentionally left as a next step
- **Read receipts** — the `ReadState` model exists in the schema but isn't wired to routes yet.
- **File/image attachments** — would need object storage (S3-compatible) + a signed-upload flow.
- **Rate limiting** on `message:send` (per-user token bucket in Redis) before going to production.
- **Push notifications** for offline users — hook into the `message:new` publish path.
- **Membership-lookup caching** — `ws.gateway.ts` hits Postgres per message to resolve conversation
  members; for very large groups, cache membership sets in Redis and invalidate on membership changes.
- **PgBouncer** in front of Postgres once you're running several server instances.
