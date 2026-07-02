import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ZodSerializationException, ZodValidationException } from "nestjs-zod";
import { ZodError } from "zod";

import env from "../../lib/env";
import { errorResponse } from "../../lib/utils";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let details = "Internal server error";

    // Dev-only: expose the real message for unknown errors
    const isDev = env.NODE_ENV !== "production";

    if (exception instanceof ZodValidationException) {
      // Transform Zod validation errors into readable field messages
      status = HttpStatus.BAD_REQUEST;
      const zodError = exception.getZodError();

      if (zodError instanceof ZodError) {
        details = zodError.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");
      }
    } else if (exception instanceof ZodSerializationException) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const zodError = exception.getZodError();

      if (zodError instanceof ZodError) {
        this.logger.error("Response serialization failed", zodError.message);
        details = isDev ? zodError.message : "Response validation failed";
      } else {
        details = "Response validation failed";
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      details =
        typeof res === "string"
          ? res
          : (((res as Record<string, unknown>).message as string) ??
            exception.message);

      if (Array.isArray(details)) details = details[0];
      if ((status as number) >= 500 && !isDev) {
        details = "Internal server error";
      }
    } else if (exception instanceof Error) {
      // SyntaxError, TypeError, etc.
      details = isDev ? exception.message : "Internal server error";
      this.logger.error("Unhandled exception", exception);
    } else {
      details = "Internal server error";
      this.logger.error(
        "Unhandled exception",
        exception ? exception : undefined,
      );
    }

    response.status(status).json(errorResponse(details));
  }
}
