# Realtime Chat App — ElysiaJS + Next.js

Scalable chat with 1:1 messaging, groups, live presence, typing indicators,
emoji reactions, and read receipts.

## Stack
- **Server:** ElysiaJS (Bun), native WebSockets, Prisma + PostgreSQL, Redis (pub/sub + presence)
- **Client:** Next.js App Router, React Context (auth + socket) + custom hooks, Zustand (realtime data store), Tailwind

## Client architecture
- `lib/context/AuthContext.tsx` — owns the token + current user. `useAuth()`.
- `lib/context/SocketContext.tsx` — owns the single WebSocket connection (reconnect, heartbeat). `useSocket()`.
- `lib/store.ts` — Zustand store; the landing spot for every inbound WS event. Components never touch this directly.
- `lib/hooks/*` — one hook per feature, each a thin, reusable API over the store + socket:
  - `useConversations()` — list, refresh, startDirect, createGroup
  - `useMessages(conversationId)` — messages, sendMessage (optimistic), loadMore (pagination)
  - `useTyping(conversationId)` — typingUsernames, debounced notifyTyping
  - `usePresence()` — isOnline(userId), lastSeen(userId)
  - `useReactions(conversationId)` — addReaction, removeReaction, toggleReaction
  - `useReadReceipts(conversationId)` — auto-marks latest message read, exposes who's seen it

Any component can compose these freely — e.g. `ChatWindow` uses five of them
together without knowing anything about WebSocket frames or Redis.

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

### The presence bug that was fixed
`presence:update` only fires on a *change* (offline→online / online→offline).
A client connecting fresh never learns who was **already** online — so the
old version showed everyone as offline until they happened to toggle status
while you were watching. Fixed by:
1. `GET /conversations` already returns each member's current online flag —
   the store now seeds `onlineUserIds` from that on load.
2. On WS connect, the server now also sends a one-time `presence:bulk`
   snapshot (`getContactIds` + `getOnlineStatuses`) covering everyone you
   share a conversation with, so the UI is correct within one round trip
   even before the REST call resolves.

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
- `WS /ws?token=<jwt>` — client→server: `message:send`, `typing:start/stop`,
  `conversation:join`, `presence:ping`, `message:read`, `reaction:add`,
  `reaction:remove`. server→client: `connected`, `message:new`,
  `message:ack`, `presence:bulk`, `presence:update`, `typing:update`,
  `read:update`, `reaction:update`, `error`

## What's intentionally left as a next step
- **File/image attachments** — would need object storage (S3-compatible) + a signed-upload flow.
- **Rate limiting** on `message:send` (per-user token bucket in Redis) before going to production.
- **Push notifications** for offline users — hook into the `message:new` publish path.
- **Membership-lookup caching** — `ws.gateway.ts` hits Postgres per message to resolve conversation
  members; for very large groups, cache membership sets in Redis and invalidate on membership changes.
- **PgBouncer** in front of Postgres once you're running several server instances.
