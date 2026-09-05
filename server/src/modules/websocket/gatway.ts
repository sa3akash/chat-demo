import Elysia, { t } from "elysia";
import { messageSchema } from "./types";
import { addUser, disconnectUser } from "./socketStore";
import { flushOfflineQueue, messageHandler } from "./handler";
import { logger } from "@/lib/logger";

function verifyToken(token: string) {
  return {
    userId: token,
  };
}

const auth = new Elysia({ name: "ws-auth" }).derive(
  { as: "scoped" },
  async ({ query, status }) => {
    const userId = await verifyToken(query.token);
    if (!userId) return status(401);
    return { userId: userId.userId };
  },
);

export const websocket = new Elysia().use(auth).ws("/ws", {
  query: t.Object({ token: t.String() }),
  body: messageSchema,
  async open(ws) {
    const userId = ws.data.userId as string;

    if (!userId) {
      ws.close(4001, "Missing userId query param");
      return;
    }
    logger.info(`user ${userId} connected to socketId ${ws.id}`);

    await addUser(userId, ws);
    await flushOfflineQueue(userId, ws);
  },

  async message(ws, message) {
    logger.info(`message sender ${message.type}`);

    console.log(JSON.stringify(message, null, 2));

    await messageHandler(message, ws.id);
  },

  async close(ws) {
    const userId = ws.data.userId;
    if (userId) {
      await disconnectUser(userId, ws);
    }

    logger.info(`user ${userId} disconnected from socketId ${ws.id}`);
  },
});
