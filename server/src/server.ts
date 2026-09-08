import { Elysia } from "elysia";
import { errorMiddleware } from "./middlewares/error";
import { setGatewayServer, websocket } from "./modules/websocket/gatway";
import { logger } from "./lib/logger";
import { dbConnect, dbDisconnect } from "./db";
import { openapi } from "@elysia/openapi";
import { authRoutes } from "./modules/auth";
import { conversationRoutes } from "./modules/conversations";
import { messagesRoutes } from "./modules/messages";
import { uploadRoutes } from "./modules/upload";
import { AppError } from "./lib/customError";
import { cors } from "@elysia/cors";
import { join } from "path";

const UPLOADS_ROOT = join(process.cwd(), "uploads");

const app = new Elysia()
  .error({
    AppError,
  })

  .use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "*"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "*"],
    maxAge: 86400,
    preflight: true,
  }))

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

  // Static file serving for uploads (images, audio, videos, files)
  .get("/uploads/*", async ({ params, set }: any) => {
    const filePath = join(UPLOADS_ROOT, params["*"]);
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      set.status = 404;
      return { error: "File not found" };
    }
    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": file.type || "application/octet-stream",
      },
    });
  })

  .use(authRoutes)
  .use(conversationRoutes)
  .use(messagesRoutes)
  .use(uploadRoutes)
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
);

app.listen(4400, (server) => {
  setGatewayServer(server);
  dbConnect()
    .then(() => {
      logger.info(
        `🦊 Elysia is running at http://${server?.hostname}:${server?.port}/docs`,
      );
      logger.info(`📁 Static files served from: ${UPLOADS_ROOT}`);
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
