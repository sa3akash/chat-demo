import bearer from "@elysia/bearer";
import { Elysia } from "elysia";

function verifyToken(token: string) {
  return {
    userId: "123",
    role: "user",
  };
}

export const auth = new Elysia({ name: "auth-middleware" })
  .use(bearer())
  .derive({ as: "global" }, ({ bearer }) => {
    if (!bearer) {
      return { user: null };
    }

    const user = verifyToken(bearer);
    if (!user) {
      return { user: null };
    }

    return { user };
  })
  .macro({
    isAuth: {
      resolve: ({ headers, user, status }) => {
        if (!user) {
          return status(401);
        }

        return user;
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
