import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

import env from "../../lib/env";
import { errorResponse } from "../../lib/utils";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let details = "Internal server error";

    // Dev-only: expose the real message for unknown errors
    const isDev = env.NODE_ENV !== "production";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        details = res;
      } else if (typeof res === "object" && res != null) {
        // NestJS default shape is { message: string | string[], error, statusCode }
        // Better Auth / other libs may return { message, code, status }
        const body = res as Record<string, unknown>;
        details =
          ((Array.isArray(body.message)
            ? body.message[0]
            : body.message) as string) ?? exception.message;
      }

      // Don't leak internals on 500 in prod
      if ((status as number) >= 500 && !isDev) {
        details = "Internal server error";
      }
    } else if (exception instanceof Error) {
      // Unknown error type (TypeError, SyntaxError, etc.)
      if (isDev) details = exception.message;
      console.error("Unhandled error:", exception);
    } else {
      if (isDev) details = String(exception);
      console.error("Unhandled error:", exception);
    }

    response.status(status).json(errorResponse(details));
  }
}
