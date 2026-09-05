import { Elysia } from "elysia";
import { AppError, errorMiddleware } from "./middlewares/error";
import { websocket } from "./modules/websocket/gatway";

const app = new Elysia()
  .error({
    AppError,
  })

  .get("/", () => "Hello Elysia")


  .use(websocket)
  .use(errorMiddleware)
  .listen(4400);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
