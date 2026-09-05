import Elysia from "elysia";
import { logger } from "../lib/logger";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string) {
    super(message, 500);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string) {
    super(message, 429);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export const errorMiddleware = new Elysia({ name: "error-middleware" }).onError(
  ({ error, set }) => {
    let statusCode = 500;
    let errorMessage = "Internal Server Error";
    let errorCode = "INTERNAL_ERROR";

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
