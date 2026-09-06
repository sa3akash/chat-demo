import { SecureTokenService } from "@/lib/SecureTokenService";
import bearer from "@elysia/bearer";
import { Elysia } from "elysia";
import { UnauthorizedError } from "./error";

export interface AuthPayload {
  username: string;
  id: string;
}

export const tokenEngine = new SecureTokenService(process.env.TOKEN_SECRET!);

function verifyToken(token: string) {
  const result = tokenEngine.decrypt<AuthPayload>(token);

  if (!result.success) {
    throw new UnauthorizedError("Invalid token");
  }

  return {
    userId: result.data.id,
    username: result.data.username,
  };
}

export const auth = new Elysia({ name: "auth-middleware" })
  .use(bearer())
  // .derive({ as: "global" }, ({ bearer }) => {
  //   if (!bearer) {
  //     return { user: null };
  //   }

  //   const user = verifyToken(bearer);
  //   if (!user) {
  //     return { user: null };
  //   }

  //   return { user };
  // })
  .macro({
    isAuth: {
      resolve: ({ headers, bearer, status }) => {
        if (!bearer) {
          return status(401);
        }

        const user = verifyToken(bearer);

        return {
          user,
        };
      },
    },
  });

// run all routes
// export const auth = new Elysia({ name: "auth-middleware" })
//   .use(bearer())
//   .derive({ as: "global" }, ({ bearer }) => {
//     if (!bearer) return error(401, "Unauthorized")
//     const user = verifyToken(bearer)
//     if (!user) return error(401, "Invalid token")
//     return { user }
//   })
