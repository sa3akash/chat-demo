import { Elysia } from "elysia";
import { AppError, errorMiddleware } from "./middlewares/error";
import { websocket } from "./modules/websocket/gatway";
import { logger } from "./lib/logger";
import { dbConnect, dbDisconnect } from "./db";
import { openapi } from "@elysia/openapi";
import { authRoutes } from "./modules/auth";
import { conversationRoutes } from "./modules/conversations";

const app = new Elysia()
  .error({
    AppError,
  })
  .use(
    openapi({
      path: "/docs",
      documentation: {
        info: {
          title: "Elysia API",
          version: "1.0.0",
        },
        components: {
          securitySchemes: {
            Bearer: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [{ Bearer: [] }],
      },
    }),
  )

  .use(authRoutes)
  .use(conversationRoutes)
  .get("/health", () => ({
    message: "OK",
    version: "1.0.0",
    status: "running",
  }))

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
