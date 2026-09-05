import Elysia, { t } from "elysia";
import { messageSchema } from "./types";
import { addUser, disconnectUser } from "./socketStore";
import { flushOfflineQueue, messageHandler } from "./handler";

function verifyToken(token: string) {
  return {
    userId: "123",
    role: "user",
  };
}

const auth = new Elysia({ name: "ws-auth" }).derive(
  { as: "scoped" },
  async ({ query, status }) => {
    const userId = await verifyToken(query.token);
    if (!userId) return status(401);
    return { userId: "123", role: "user" };
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

    await addUser(userId, ws);
    await flushOfflineQueue(userId, ws);
  },

  async message(ws, message) {
    await messageHandler(message);
  },

  async close(ws) {
    const userId = ws.data.userId;
    if (userId) {
      await disconnectUser(userId, ws);
    }
  },
});



