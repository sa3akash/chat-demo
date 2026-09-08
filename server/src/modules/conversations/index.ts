import { Elysia } from "elysia";
import { Conversation } from "./service";
import { auth } from "@/middlewares/auth";
import { ConversationModel } from "./model";
import { table, db, conversationMembers, users } from "@/db";
import { createInsertSchema, createSelectSchema } from "drizzle-typebox";
import { t } from "elysia";
import { redisClient } from "../websocket/redis";
import { eq, inArray } from "drizzle-orm";

const _conversatonSchema = createInsertSchema(table.conversations);
const _userSchema = createSelectSchema(table.users);

export const conversationRoutes = new Elysia({ prefix: "/conversations" })
  .use(auth)
  .post(
    "/",
    async ({ body, user }) => {
      const response = await Conversation.createConversation(body, user.userId);

      // Broadcast new conversation to all participants for real-time sidebar sync
      try {
        const conversation = response.conversation;
        const memberRows = await db
          .select({ userId: conversationMembers.userId })
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, conversation.id));

        // Fetch full conversation data (with members) for each participant
        const allMemberIds = memberRows.map((m) => m.userId);
        if (allMemberIds.length > 0) {
          // Fetch member user info for populating otherUser on the client side
          const memberUsers = await db
            .select({ id: users.id, username: users.username, email: users.email })
            .from(users)
            .where(inArray(users.id, allMemberIds));

          const isDirect = conversation.type === "direct";

          // Notify each participant
          for (const memberId of allMemberIds) {
            const otherUser = isDirect
              ? memberUsers.find((u) => u.id !== memberId) ?? null
              : null;

            const payload = JSON.stringify({
              type: "conversation:new",
              payload: {
                conversation: {
                  id: conversation.id,
                  type: conversation.type,
                  title: isDirect ? (otherUser?.username ?? "Unknown User") : conversation.title,
                  iconUrl: conversation.iconUrl,
                  lastMessageAt: conversation.lastMessageAt,
                  metadata: conversation.metadata ?? {},
                  unreadCount: 0,
                  isMuted: false,
                  isPinned: false,
                  isArchived: false,
                  latestMessage: null,
                  members: memberUsers,
                  otherUser: isDirect ? otherUser : null,
                },
              },
            });

            await redisClient.publish(`channel:user:${memberId}`, payload);
          }
        }
      } catch (err: any) {
        // Non-critical: socket broadcast failure should not break HTTP response
        console.error("Failed to broadcast conversation:new via Redis:", err?.message);
      }

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
        200: t.Pick(_userSchema, ["id", "username", "email"]),
        400: ConversationModel.createConversationInvalid,
      },
      detail: {
        summary: "Get Others User",
        tags: ["Conversation"],
      },
    },
  );
