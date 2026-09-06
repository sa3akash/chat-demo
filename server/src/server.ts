import { Elysia } from "elysia";
import { errorMiddleware } from "./middlewares/error";
import { websocket } from "./modules/websocket/gatway";
import { logger } from "./lib/logger";
import { dbConnect, dbDisconnect } from "./db";
import { openapi } from "@elysia/openapi";
import { authRoutes } from "./modules/auth";
import { conversationRoutes } from "./modules/conversations";
import { messagesRoutes } from "./modules/messages";
import { AppError } from "./lib/customError";

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
  .use(messagesRoutes)
  .get("/health", () => ({
    message: "OK",
    version: "1.0.0",
    status: "running",
  }))
  
  .use(websocket)
  .all("/*", () => {
    logger.warn({ path: "/*" }, "💥 Not Found");
    throw new AppError("Not Found", 404);
  },{
    detail: {
      hide:true
    }
  })
  .onError(
  ({ error, set }) => {
    let statusCode = 500;
    let errorMessage = "Internal Server Error";
    let errorCode = "INTERNAL_ERROR";

    console.log("error", error);

    if (error instanceof AppError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
      errorCode = error.status.toUpperCase() + "_ERROR";
    } else {
      logger.error({ err: error }, "💥 Unhandled Exception");
    }

    set.status = statusCode;
    return {
      success: false,
      error: errorCode,
      message: errorMessage,
    };
  },
)

  .listen(4400, () => {
    dbConnect()
      .then(() => {
        logger.info(
          `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}/docs`,
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
