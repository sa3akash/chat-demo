import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { prisma } from "@/db/client";
import { verifyTokenFromQuery } from "@/middleware/auth.middleware";
import { pubsub, conversationChannel, PRESENCE_CHANNEL } from "@/redis/pubsub";
import { markOnline, markOffline, heartbeat, getContactIds, getOnlineStatuses } from "./presence.service";

/**
 * In-memory registry of sockets connected to THIS process, keyed by userId.
 * A user can have several sockets here (multiple tabs/devices). This map is
 * local and NOT shared across instances — cross-instance delivery happens
 * through Redis pub/sub (see conversationChannel below), so it doesn't
 * matter which node a recipient is connected to.
 */
const localSockets = new Map<string, Set<any>>();
const activeConversationSubs = new Map<string, (payload: any) => void>();

function addLocalSocket(userId: string, ws: any) {
  if (!localSockets.has(userId)) localSockets.set(userId, new Set());
  localSockets.get(userId)!.add(ws);
}

function removeLocalSocket(userId: string, ws: any) {
  localSockets.get(userId)?.delete(ws);
  if (localSockets.get(userId)?.size === 0) localSockets.delete(userId);
}

function sendToLocalUser(userId: string, payload: unknown) {
  const sockets = localSockets.get(userId);
  if (!sockets) return;
  const data = JSON.stringify(payload);
  for (const ws of sockets) {
    try {
      ws.send(data);
    } catch {
      // socket likely dead; cleanup happens in the close handler
    }
  }
}

async function ensureSubscribed(conversationId: string) {
  if (activeConversationSubs.has(conversationId)) return;
  const handler = async (payload: any) => {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    for (const { userId } of members) {
      sendToLocalUser(userId, payload);
    }
  };
  activeConversationSubs.set(conversationId, handler);
  await pubsub.subscribe(conversationChannel(conversationId), handler);
}

// Presence changes fan out globally at the transport layer (cheap — it's
// just a userId + status), but each *client* only acts on updates for
// people it actually shares a conversation with (filtered client-side via
// the presence:bulk contact list). For a huge user base you'd instead scope
// this at publish time using getContactIds, trading a bit of publish-time
// cost for less irrelevant traffic — straightforward swap later.
pubsub.subscribe(PRESENCE_CHANNEL, (payload) => {
  for (const [userId] of localSockets) {
    sendToLocalUser(userId, { type: "presence:update", ...payload });
  }
});

const wsMessageSchema = t.Union([
  t.Object({
    type: t.Literal("message:send"),
    conversationId: t.String(),
    content: t.String({ minLength: 1, maxLength: 4000 }),
    tempId: t.Optional(t.String()),
  }),
  t.Object({ type: t.Literal("typing:start"), conversationId: t.String() }),
  t.Object({ type: t.Literal("typing:stop"), conversationId: t.String() }),
  t.Object({ type: t.Literal("conversation:join"), conversationId: t.String() }),
  t.Object({ type: t.Literal("presence:ping") }),
  t.Object({
    type: t.Literal("message:read"),
    conversationId: t.String(),
    messageId: t.String(),
  }),
  t.Object({
    type: t.Literal("reaction:add"),
    conversationId: t.String(),
    messageId: t.String(),
    emoji: t.String({ minLength: 1, maxLength: 8 }),
  }),
  t.Object({
    type: t.Literal("reaction:remove"),
    conversationId: t.String(),
    messageId: t.String(),
  }),
]);

export const wsGateway = new Elysia().ws("/ws", {
  body: wsMessageSchema,

  async open(ws) {
    const token = ws.data.query?.token as string | undefined;
    const user = await verifyTokenFromQuery(token);
    if (!user) {
      ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
      ws.close();
      return;
    }

    (ws.data as any).userId = user.id;
    addLocalSocket(user.id, ws.raw ?? ws);
    await markOnline(user.id);

    const memberships = await prisma.conversationMember.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    });
    await Promise.all(memberships.map((m) => ensureSubscribed(m.conversationId)));

    // THE FIX: presence:update events only ever tell you about a *change*.
    // Without this, anyone who was already online before you connected
    // stays "offline" in your UI forever (or until they happen to
    // reconnect while you're watching). Send a one-time snapshot of
    // everyone you share a conversation with right after connecting.
    const contactIds = await getContactIds(user.id);
    const statuses = await getOnlineStatuses(contactIds);
    ws.send(JSON.stringify({ type: "presence:bulk", statuses }));

    ws.send(JSON.stringify({ type: "connected", userId: user.id }));
  },

  async message(ws, body) {
    const userId = (ws.data as any).userId as string | undefined;
    if (!userId) return;

    switch (body.type) {
      case "message:send": {
        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: body.conversationId, userId } },
        });
        if (!membership) {
          ws.send(JSON.stringify({ type: "error", message: "Not a member of this conversation" }));
          return;
        }

        const message = await prisma.message.create({
          data: { id: nanoid(), conversationId: body.conversationId, senderId: userId, content: body.content },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true } },
            reactions: true,
          },
        });

        await prisma.conversation.update({
          where: { id: body.conversationId },
          data: { updatedAt: new Date() },
        });

        await pubsub.publish(conversationChannel(body.conversationId), { type: "message:new", message });

        if (body.tempId) {
          ws.send(JSON.stringify({ type: "message:ack", tempId: body.tempId, message }));
        }
        break;
      }

      case "typing:start":
      case "typing:stop": {
        await pubsub.publish(conversationChannel(body.conversationId), {
          type: "typing:update",
          conversationId: body.conversationId,
          userId,
          isTyping: body.type === "typing:start",
        });
        break;
      }

      case "conversation:join": {
        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: body.conversationId, userId } },
        });
        if (membership) await ensureSubscribed(body.conversationId);
        break;
      }

      case "presence:ping": {
        await heartbeat(userId);
        break;
      }

      case "message:read": {
        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: body.conversationId, userId } },
        });
        if (!membership) return;

        await prisma.readState.upsert({
          where: { conversationId_userId: { conversationId: body.conversationId, userId } },
          create: { conversationId: body.conversationId, userId, lastReadMessageId: body.messageId },
          update: { lastReadMessageId: body.messageId },
        });

        await pubsub.publish(conversationChannel(body.conversationId), {
          type: "read:update",
          conversationId: body.conversationId,
          userId,
          lastReadMessageId: body.messageId,
        });
        break;
      }

      case "reaction:add": {
        const membership = await prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: body.conversationId, userId } },
        });
        if (!membership) return;

        await prisma.reaction.upsert({
          where: { messageId_userId: { messageId: body.messageId, userId } },
          create: { messageId: body.messageId, userId, emoji: body.emoji },
          update: { emoji: body.emoji },
        });

        const reactions = await prisma.reaction.findMany({ where: { messageId: body.messageId } });
        await pubsub.publish(conversationChannel(body.conversationId), {
          type: "reaction:update",
          conversationId: body.conversationId,
          messageId: body.messageId,
          reactions,
        });
        break;
      }

      case "reaction:remove": {
        await prisma.reaction
          .delete({ where: { messageId_userId: { messageId: body.messageId, userId } } })
          .catch(() => {});
        const reactions = await prisma.reaction.findMany({ where: { messageId: body.messageId } });
        await pubsub.publish(conversationChannel(body.conversationId), {
          type: "reaction:update",
          conversationId: body.conversationId,
          messageId: body.messageId,
          reactions,
        });
        break;
      }
    }
  },

  async close(ws) {
    const userId = (ws.data as any).userId as string | undefined;
    if (!userId) return;
    removeLocalSocket(userId, ws.raw ?? ws);
    await markOffline(userId);
  },
});
