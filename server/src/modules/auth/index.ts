import { Elysia, t } from "elysia";

import { Auth } from "./service";
import { AuthModel } from "./model";
import { createInsertSchema } from "drizzle-typebox";
import { table } from "@/db";
import { auth } from "@/middlewares/auth";

const _userSchema = createInsertSchema(table.users, {
  email: t.String({ format: "email" }),
});

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(auth)
  .post(
    "/sign-in",
    async (ctx) => {
      return await Auth.signIn(ctx.body, ctx);
    },
    {
      body: AuthModel.signInBody,
      // response is optional, use to enforce return type
      response: {
        200: AuthModel.authTokensResponse,
        400: AuthModel.signInInvalid,
      },
      detail: {
        summary: "User Sign In",
        tags: ["Auth"],
      },
    },
  )
  .post(
    "/sign-up",
    async (ctx) => {
      return await Auth.signUp(ctx.body, ctx);
    },
    {
      body: AuthModel.signupBody,
      // response is optional, use to enforce return type
      response: {
        200: AuthModel.authTokensResponse,
        400: AuthModel.signUpError,
      },
      detail: {
        summary: "User Sign Up",
        tags: ["Auth"],
      },
    },
  )
  .post(
    "/refresh",
    async (ctx) => {
      return await Auth.refreshToken(ctx.body);
    },
    {
      body: AuthModel.refreshTokenBody,
      response: {
        200: AuthModel.authTokensResponse,
      },
      detail: {
        summary: "User Refresh Token",
        tags: ["Auth"],
      },
    },
  )
  .post(
    "/logout",
    async (ctx) => {
      return await Auth.logout(ctx.body);
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
      response: {
        200: t.Object({
          message: t.String(),
        }),
      },
      detail: {
        summary: "User Logout",
        tags: ["Auth"],
      },
    },
  )

  .get(
    "/me",
    async (ctx) => {
      return await Auth.me(ctx.user!.userId);
    },
    {
      isAuth: true,
      response: {
        200: t.Object({
          user: t.Omit(_userSchema, ["passwordHash"]),
        }),
      },
      detail: {
        summary: "Get user profile",
        tags: ["Auth"],
      },
    },
  )
  .get(
    "/search",
    async (ctx) => {
      return await Auth.searchUserByUsername(
        ctx.query.username,
        ctx.user.userId,
      );
    },
    {
      query: t.Object({
        username: t.String(),
      }),
      isAuth: true,
      response: {
        200: t.Array(t.Pick(_userSchema, ["username","id"])),
      },
      detail: {
        summary: "Search user by username",
        tags: ["Auth"],
      },
    },
  );
