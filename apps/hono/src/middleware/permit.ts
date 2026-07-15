import { createMiddleware } from "hono/factory";

import { auth } from "@/lib/auth";
import HttpStatusCodes from "@/lib/http-status-codes";
import { errorResponse } from "@/lib/utils";
import type { AppEnv } from "@/types";

export const permit = (permissions: Record<string, string[]>) => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");

    if (!user || !user.id || !user.role) {
      return c.json(
        errorResponse("FORBIDDEN", "No user or role assigned"),
        HttpStatusCodes.FORBIDDEN,
      );
    }

    const result = await auth.api.userHasPermission({
      body: {
        userId: user.id,
        permissions,
      },
    });

    if (!result.success) {
      return c.json(
        errorResponse(
          "FORBIDDEN",
          "User does not have the required permission",
        ),
        HttpStatusCodes.FORBIDDEN,
      );
    }

    await next();
  });
};
