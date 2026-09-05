import { Elysia } from "elysia";
import { AppError, errorMiddleware } from "./middlewares/error";
import { websocket } from "./modules/websocket/gatway";
import { logger } from "./lib/logger";
import { dbConnect, dbDisconnect } from "./db";

const app = new Elysia()
  .error({
    AppError,
  })

  .get("/", () => "Hello Elysia")

  .use(websocket)
  .use(errorMiddleware)
  .listen(4400, () => {
    dbConnect()
      .then(() => {
        logger.info(
          `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
        );
      })
      .catch((error) => {
        logger.error(error, "Database connection error");
        process.exit(1);
      });
  });

process.on("SIGINT", async () => {
  logger.info("Shutting down server...");
  await dbDisconnect();
  app.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down server...");
  await dbDisconnect();
  app.stop();
  process.exit(0);
});
