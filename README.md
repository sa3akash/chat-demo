# Scalable & Advanced WebSocket Server and Client Architecture

## Overview

This plan transforms the current experimental WebSocket implementation into an enterprise-ready, horizontally scalable, and feature-rich real-time communication system. It bridges the Elysia WebSocket gateway with Redis Cluster Pub/Sub, PostgreSQL message persistence, robust connection lifecycle management, and a rich client-side reactive state layer.

---

## Architectural Analysis & Current Bottlenecks

1. **Redis Pub/Sub Bugs & Scalability**:
   - `redisSub.subscribe(channel, (rawMessage) => ws.publish(...))` uses `ioredis` incorrectly (the callback is for subscription confirmation `(err, count)`, not incoming messages). As a result, pub/sub forwarding does not work.
   - Routing was limited to user channels (`channel:user:${id}`). Broadcasting to multi-user rooms or conversations required redundant queries and messages.
   - Direct messages sent via WebSocket were never persisted to PostgreSQL (`messages` table), causing messages to disappear on page reload.
2. **Absence of Core Real-Time Chat Primitives**:
   - No typing indicators (debounce, ephemeral broadcast, TTL).
   - No read receipts or message delivery acknowledgments (updating `lastReadMessageId` and `unreadCount`).
   - No room/conversation joining mechanism for granular topic subscriptions (`conversation:${id}`).
3. **Client-Side Disconnects & Fragility**:
   - `SocketContext.tsx` had no automatic reconnection with exponential backoff; if a socket dropped, the client remained disconnected forever.
   - `ChatFooter.tsx` tried to access `socket.send` (which was not exposed in `useSocket()`) with hardcoded dummy IDs.
   - `ChatMessage.tsx` rendered static dummy messages instead of fetching and listening for live messages.
   - The conversation list (`conversation.tsx`) was completely static and did not update when new messages arrived or when users came online/offline.

---

## Proposed Architecture & Design

```
+-------------------------------------------------------------------------------+
|                                CLIENT BROWSER                                 |
|                                                                               |
|  [SocketProvider]                                                             |
|   - Auto-reconnect with jittered exponential backoff                          |
|   - Heartbeat / Lease Keepalive                                               |
|   - Typed Event Dispatcher (messages, typing, receipts, presence)             |
|   - Conversation Room Manager (join / leave)                                  |
|   - Optimistic message state & offline buffering                              |
+---------------------------------------+---------------------------------------+
                                        |  WebSocket Connection (?token=...)
                                        v
+-------------------------------------------------------------------------------+
|                       ELYSIA WEBSOCKET GATEWAY (NODE)                         |
|                                                                               |
|  [ws-auth] Session Token Verification & Connection Context                   |
|  [Topic Bridge] Bun native uWS pub/sub topics:                                |
|    - `user:${userId}` (direct messages, notifications, personal receipts)    |
|    - `conversation:${conversationId}` (chat messages, typing, read receipts)  |
|  [Event Router & Controllers]                                                 |
|    - chat:send -> Persist to DB -> Publish to Redis -> Ack to Sender          |
|    - typing:update -> Ephemeral Redis Publish                                 |
|    - receipt:read -> Update DB unread counts -> Broadcast receipt             |
|    - heartbeat -> Bump Redis presence lease TTL                               |
+-------------------+---------------------------------------+-------------------+
                    |                                       |
                    v                                       v
+-----------------------------------+   +---------------------------------------+
|          REDIS CLUSTER            |   |          POSTGRESQL (DRIZZLE)         |
|  - Dual client: command & sub     |   |  - messages table (insert/query)      |
|  - Pattern Sub: `channel:*`       |   |  - conversations table (lastMessage)  |
|  - Presence Keys: `presence:${id}`|   |  - conversationMembers (unread counts)|
+-----------------------------------+   +---------------------------------------+
```

---

## Proposed Changes

### Server (`server/`)

- **Robust Redis Connection Manager**:
  - Add connection error handling, automatic reconnection, and clean lifecycle management for both `redisClient` and `redisSub`.
  - Fix `redisSub.on("message", ...)` to dispatch Redis pub/sub messages to Bun's native uWS `app.server.publish(...)` across local node topics.
- **Hierarchical Topic Subscriptions**:
  - `user:${userId}`: For personal notifications, direct conversation invitations, and account alerts.
  - `conversation:${conversationId}`: Room-based subscription when a user opens a conversation.
- **Message Persistence & Pipeline**:
  - In `chat:send` / `send_message`: Validate payload with TypeBox, persist message directly to PostgreSQL via `Message.sendMessage`, update conversation `lastMessageAt`, and publish to `channel:conversation:${conversationId}` so all cluster instances deliver it instantly.
  - Return acknowledgment (`message:ack`) to the sender with the generated database `id` and timestamp.
- **Typing Indicator Protocol**:
  - Handle `typing:start` and `typing:stop` events with rate limiting. Broadcast ephemeral typing events to `channel:conversation:${conversationId}`.
- **Read & Delivery Receipts**:
  - Handle `receipt:read`: Updates member's `lastReadMessageId` and resets `unreadCount` to 0 in `conversationMembers` table, and broadcasts `receipt:read` to the conversation room.
- **Scalable Presence Engine**:
  - Heartbeat with 45s TTL lease.
  - Broadcast `presence:update` (`online` / `offline`) on cluster channel when user enters or closes their last socket.
  - Keep `/api/presence/batch` fast and cached.

---

### Client (`client/`)

- Standardize all client-server WebSocket event frames:
  - Inbound & Outbound: `chat:send`, `chat:new`, `chat:ack`, `typing:update`, `receipt:read`, `presence:batch`, `presence:update`, `room:join`, `room:leave`.

- Add robust reconnection logic with exponential backoff and jitter.
- Expose typed helpers:
  - `joinConversation(conversationId: string)` & `leaveConversation(conversationId: string)`.
  - `sendChatMessage(conversationId: string, content: string, type?: string)` with temporary local ID support.
  - `sendTyping(conversationId: string, isTyping: boolean)`.
  - `markAsRead(conversationId: string, messageId: string)`.
  - Real-time `onlineUserIds` set automatically updated via `presence:update` broadcasts and batch checks.

- Custom hook for a specific conversation:
  - Loads historical messages (with cursor pagination).
  - Joins the conversation room on mount, leaves on unmount.
  - Appends incoming real-time messages.
  - Optimistic sending: adds temporary local message with pending state until server ack arrives.
  - Tracks typing users with a timer (auto-clears typing indicator if no stop signal arrives after 4 seconds).
  - Automatically triggers `markAsRead` when viewing new messages.

- Add a client wrapper or convert to dynamic list that updates last message snippet, timestamp, and unread badge live when socket receives new messages for any conversation.

---

## Verification Plan

### Automated & Backend Verification

1. **Server TypeCheck & Startup**:
   - Run `bun run --watch src/server.ts` or test script in `server` to ensure no syntax/type errors.
2. **WebSocket Integration Test Script**:
   - Write a test script in `server/scripts/test-ws.ts` that:
     - Connects 2 separate WebSocket clients authenticated with valid tokens.
     - Tests room join (`room:join`), message sending (`chat:send`), DB persistence verification, Redis pub/sub delivery to recipient, typing indicator broadcast, and read receipts.
     - Confirms Redis presence TTL and heartbeat.

### Manual Verification

1. Open two browser windows / tabs with two distinct test users in `/chat`.
2. Send a message from User A to User B:
   - Message should immediately appear optimistically on User A's screen.
   - Message should be persisted in the database.
   - Message should pop up instantly in User B's active conversation without page refresh.
   - User B's conversation sidebar should update with latest message and unread count.
3. Test typing: Type in User A's input -> User B sees "User A is typing..." in real time.
4. Test presence: Log out or close User A's tab -> User A shows offline on User B's screen.
