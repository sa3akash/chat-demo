import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { registerUser, validateCredentials } from "./auth.service";

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
      exp: "7d",
    })
  )
  .post(
    "/register",
    async ({ body, jwt, set }) => {
      try {
        const user = await registerUser(body.email, body.username, body.password);
        const token = await jwt.sign({ sub: user.id });
        return {
          token,
          user: { id: user.id, email: user.email, username: user.username },
        };
      } catch (err) {
        set.status = 409;
        return { error: (err as Error).message };
      }
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        username: t.String({ minLength: 3, maxLength: 32 }),
        password: t.String({ minLength: 8 }),
      }),
    }
  )
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      const user = await validateCredentials(body.email, body.password);
      if (!user) {
        set.status = 401;
        return { error: "Invalid email or password" };
      }
      const token = await jwt.sign({ sub: user.id });
      return {
        token,
        user: { id: user.id, email: user.email, username: user.username },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String(),
      }),
    }
  );
