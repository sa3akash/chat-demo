import { AppError } from "@/lib/customError";
import { logger } from "@/lib/logger";
import Elysia from "elysia";


export const errorMiddleware = new Elysia({ name: "error-middleware" })
  .error({
    AppError,
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
