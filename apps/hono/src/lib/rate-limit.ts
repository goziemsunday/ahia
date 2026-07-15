import { rateLimiter } from "hono-rate-limiter";

import HttpStatusCodes from "./http-status-codes";
import { errorResponse } from "./utils";

// Shared key generator for extracting the client IP from common proxy
// headers.
const ipKeyGenerator = (c: {
  req: { header: (name: string) => string | undefined };
}) => {
  const forwarded = c.req.header("x-forwarded-for");
  return forwarded?.split(",")[0] ?? c.req.header("x-real-ip") ?? "unknown";
};

// Rate-limit exceeded handler for returning the standard error
// response shape.
const rateLimitHandler = (c: {
  json: (body: unknown, status: number) => unknown;
}) => {
  return c.json(
    errorResponse(
      "TOO_MANY_REQUESTS",
      "Too many requests have been made. Please try again later.",
    ),
    HttpStatusCodes.TOO_MANY_REQUESTS,
  );
};

// Auth API rate limiter
export const authRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-6",
  keyGenerator: ipKeyGenerator,
  handler: rateLimitHandler,
});

// General API rate limiter
export const apiRateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  limit: 1000,
  standardHeaders: "draft-6",
  keyGenerator: ipKeyGenerator,
  handler: rateLimitHandler,
});
