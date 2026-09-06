import { Elysia } from "elysia";

import { auth } from "@/middlewares/auth";
import { Message } from "./service";
import { messageSchema, MessageSchema } from "./model";

export const messagesRoutes = new Elysia({ prefix: "/messages" })
  .use(auth)
  .post(
    "/send",
    async ({ body, user }) => {
      const message = Message.sendMessage(body, user.userId);
      return message;
    },
    {
      body: messageSchema.sendMessageBody,
      // response is optional, use to enforce return type
      isAuth: true,
      response: {
        200: messageSchema.singleMessageResponse,
        400: messageSchema.sendMessageInvalid,
      },
      detail: {
        summary: "Send a new message in a conversation",
        tags: ["Messages"],
      },
    },
  )
  .get(
    "/",
    async ({ query }) => {
      return Message.getMessagesByConversation(query);
    },
    {
      query: messageSchema.getMessagesByConversationQuery,
      // response is optional, use to enforce return type
      isAuth: true,
      response: {
        200: messageSchema.getMessagesByConversationResponse,
        400: messageSchema.getMessagesByConversationInvalid,
      },
      detail: {
        summary: "Get messages by conversation",
        tags: ["Messages"],
      },
    },
  );
