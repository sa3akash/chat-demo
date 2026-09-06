// Service handles business logic, decoupled from Elysia controller
import { Context, status } from "elysia";

import type { AuthModel } from "./model";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { refreshTokens, users } from "@/db/schema";
import { NotFoundError } from "@/middlewares/error";
import { SecureTokenService } from "@/lib/SecureTokenService";
import { AuthPayload, tokenEngine } from "@/middlewares/auth";



// If a class doesn't need to store a property,
// you can use an `abstract class` to avoid class allocation
export abstract class Auth {
  static async signIn(
    { username, password }: AuthModel["signInBody"],
    ctx:any,
  ) {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    console.log("user", user);
    if (!user[0]) {
      throw new NotFoundError("Invalid Credentials");
    }

    const validPassword = await Bun.password.verify(
      password,
      user[0].passwordHash!,
    );
    if (!validPassword) {
      throw new NotFoundError("Invalid Credentials");
    }

    // generate token
    const accessToken = tokenEngine.encrypt<AuthPayload>(
      {
        username: user[0].username,
        id: user[0].id,
      },
      {
        ttlSeconds: 60 * 60 * 24 * 7, // 7 days
        clientContext: "",
      },
    );

    const refreshToken = tokenEngine.encrypt<AuthPayload>(
      {
        username: user[0].username,
        id: user[0].id,
      },
      {
        ttlSeconds: 60 * 60 * 24 * 7 * 30, // 30 days
        clientContext: "",
      },
    );

    await db.insert(refreshTokens).values({
      userId: user[0].id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 24 * 7 * 30 * 1000),
      userAgent: ctx.request.headers.get("user-agent") || "",
      ipAddress:
        ctx.request.headers.get("x-forwarded-for") ||
        ctx.request.headers.get("remote-addr") ||
        "",
      fingerprint: ctx.request.headers.get("sec-ch-ua-platform") || "",
    });

    return {
      username,
      accessToken,
      refreshToken,
    };
  }

  static async signUp(
    { username, email, password }: AuthModel["signupBody"],
    ctx: any,
  ) {
    // check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    if (existingUser[0]) {
      throw new NotFoundError("User already exists");
    }

    // hash password
    const passwordHash = await Bun.password.hash(password); // create user
    const user = await db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
      })
      .returning();

    // generate token
    const accessToken = tokenEngine.encrypt<AuthPayload>(
      {
        username: user[0].username,
        id: user[0].id,
      },
      {
        ttlSeconds: 60 * 60 * 24 * 7, // 7 days
        clientContext: "",
      },
    );

    const refreshToken = tokenEngine.encrypt<AuthPayload>(
      {
        username: user[0].username,
        id: user[0].id,
      },
      {
        ttlSeconds: 60 * 60 * 24 * 7 * 30, // 30 days
        clientContext: "",
      },
    );

    await db.insert(refreshTokens).values({
      userId: user[0].id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 24 * 7 * 30 * 1000),
      userAgent: ctx.request.headers.get("user-agent") || "",
      ipAddress:
        ctx.request.headers.get("x-forwarded-for") ||
        ctx.request.headers.get("remote-addr") ||
        "",
      fingerprint: ctx.request.headers.get("sec-ch-ua-platform") || "",
    });

    return {
      username,
      accessToken,
      refreshToken,
    };
  }

  static async refreshToken({ refreshToken }: AuthModel["refreshTokenBody"]) {
    const validToken = tokenEngine.decrypt<{ username: string; id: string }>(
      refreshToken,
    );

    if (!validToken.success || !validToken.data.id) {
      throw new NotFoundError("Invalid Token");
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, validToken.data.id));
    if (!user[0]) {
      throw new NotFoundError("User not found");
    }

    const accessTokenNew = tokenEngine.encrypt<AuthPayload>(
      {
        username: user[0].username,
        id: user[0].id,
      },
      {
        ttlSeconds: 60 * 60 * 24 * 7, // 7 days
        clientContext: "",
      },
    );

    const refreshTokenNew = tokenEngine.encrypt<AuthPayload>(
      {
        username: user[0].username,
        id: user[0].id,
      },
      {
        ttlSeconds: 60 * 60 * 24 * 7 * 30, // 30 days
        clientContext: "",
      },
    );

    await db
      .update(refreshTokens)
      .set({
        token: refreshTokenNew,
        expiresAt: new Date(Date.now() + 60 * 60 * 24 * 7 * 30 * 1000),
      })
      .where(eq(refreshTokens.token, refreshToken));

    return {
      username: user[0].username,
      accessToken: accessTokenNew,
      refreshToken: refreshTokenNew,
    };
  }

  static async logout({ refreshToken }: { refreshToken: string }) {
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.token, refreshToken));

      return {
        message: "User logged out successfully",
      }
  }

  static async me(id: string) {
	const user = await db.select().from(users).where(eq(users.id, id)); 
	return {
		user: user[0],
	}
  }
}
