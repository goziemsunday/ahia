import { APIError } from "better-auth";
import { validator } from "hono-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  ChangePasswordSchema,
  UserUpdateSchema,
} from "@repo/db/validators/user.validator";

import { createRouter } from "@/app";
import { auth } from "@/lib/auth";
import HttpStatusCodes from "@/lib/http-status-codes";
import { errorResponse, successResponse } from "@/lib/utils";
import { authed } from "@/middleware/authed";
import { validationHook } from "@/middleware/validation-hook";

import { changePasswordDoc, getUserDoc, updateUserDoc } from "./user.docs";

const userRouter = createRouter().use(authed);

// Get user
userRouter.get("/me", getUserDoc, (c) => {
  try {
    const user = c.get("user");

    return c.json(
      successResponse(user, "User retrieved successfully"),
      HttpStatusCodes.OK,
    );
  } catch (error) {
    if (error instanceof APIError) {
      return c.json(
        errorResponse(
          error.body?.code ?? "AUTH_ERROR",
          error.body?.message ?? error.message,
        ),
        error.statusCode as ContentfulStatusCode,
      );
    }
    throw error;
  }
});

// Update user
userRouter.patch(
  "/me",
  updateUserDoc,
  validator("json", UserUpdateSchema, validationHook),
  async (c) => {
    try {
      const data = c.req.valid("json");

      const response = await auth.api.updateUser({
        body: data,
        headers: c.req.raw.headers,
      });

      return c.json(
        successResponse(response, "User updated successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      if (error instanceof APIError) {
        return c.json(
          errorResponse(
            error.body?.code ?? "AUTH_ERROR",
            error.body?.message ?? error.message,
          ),
          error.statusCode as ContentfulStatusCode,
        );
      }
      throw error;
    }
  },
);

// Change password
userRouter.post(
  "/me/password",
  changePasswordDoc,
  validator("json", ChangePasswordSchema, validationHook),
  async (c) => {
    try {
      const data = c.req.valid("json");

      const sessionToken = c.get("sessionToken");

      await auth.api.changePassword({
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          revokeOtherSessions: data.revokeOtherSessions,
        },
        headers: new Headers({
          Authorization: `Bearer ${sessionToken}`,
        }),
      });

      return c.json(
        successResponse({ status: true }, "Password changed successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      if (error instanceof APIError) {
        return c.json(
          errorResponse(
            error.body?.code ?? "AUTH_ERROR",
            error.body?.message ?? error.message,
          ),
          error.statusCode as ContentfulStatusCode,
        );
      }
      throw error;
    }
  },
);

export default userRouter;
