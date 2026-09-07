import { Elysia } from "elysia";
import { Conversation } from "./service";
import { auth } from "@/middlewares/auth";
import { ConversationModel } from "./model";
import { table } from "@/db";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";

const _conversatonSchema = createInsertSchema(table.conversations);
const _userSchema = createSelectSchema(table.users);

export const conversationRoutes = new Elysia({ prefix: "/conversations" })
  .use(auth)
  .post(
    "/",
    async ({ body, user }) => {
      const response = await Conversation.createConversation(body, user.userId);

      return response;
    },
    {
      body: ConversationModel.createConversationBody,
      // response is optional, use to enforce return type
      isAuth: true,
      response: {
        200: t.Object({
          conversation: _conversatonSchema,
        }),
        400: ConversationModel.createConversationInvalid,
      },
      detail: {
        summary: "Create Conversation",
        tags: ["Conversation"],
      },
    },
  )
  .get(
    "/",
    async ({ user }) => {
      const response = await Conversation.getConversations(user.userId);

      return response;
    },
    {
      // response is optional, use to enforce return type
      isAuth: true,
      response: {
        // 200: t.Array(_conversatonSchema),
        400: ConversationModel.createConversationInvalid,
      },
      detail: {
        summary: "Get Conversations",
        tags: ["Conversation"],
      },
    },
  )
  .get(
    "/:conversationId/others",
    async ({ params, user }) => {
      const response = await Conversation.getOthersUser(
        params.conversationId,
        user.userId,
      );

      return response;
    },
    {
      params: t.Object({
        conversationId: t.String(),
      }),
      isAuth: true,
      response: {
        200: t.Pick(_userSchema, ["username", "email"]),
        400: ConversationModel.createConversationInvalid,
      },
      detail: {
        summary: "Get Others User",
        tags: ["Conversation"],
      },
    },
  );
