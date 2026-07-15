import { APIError } from "better-auth";
import { validator } from "hono-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import { ListUsersQuerySchema } from "@repo/db/validators/admin.validator";

import { createRouter } from "@/app";
import { auth } from "@/lib/auth";
import HttpStatusCodes from "@/lib/http-status-codes";
import { PaginationQuerySchema, UuidParamSchema } from "@/lib/schemas";
import { buildPagination, errorResponse, successResponse } from "@/lib/utils";
import { authed } from "@/middleware/authed";
import { permit } from "@/middleware/permit";
import { validationHook } from "@/middleware/validation-hook";
import { createUser } from "@/queries/admin-queries";
import { getAdminOrderById, getAllOrders } from "@/queries/order-queries";
import {
  getAdminOverviewStats,
  getMonthlyStats,
} from "@/queries/stats-queries";
import { getUserById } from "@/queries/user-queries";

import {
  createUserDoc,
  getAdminMonthlyStatsDoc,
  getAdminOrderDoc,
  getAdminOrdersDoc,
  getAdminStatsDoc,
  getAllUsersDoc,
  getUserDoc,
} from "./admin.docs";

const admin = createRouter()
  .use(authed)
  .use(permit({ user: ["list"], order: ["view-user", "view-all"] }));

// Get platform stats for admin dashboard
admin.get("/stats", getAdminStatsDoc, async (c) => {
  const stats = await getAdminOverviewStats();

  return c.json(
    successResponse(stats, "Admin stats retrieved successfully"),
    HttpStatusCodes.OK,
  );
});

// Get monthly stats for charts (last 12 months)
admin.get("/stats/monthly", getAdminMonthlyStatsDoc, async (c) => {
  const monthly = await getMonthlyStats();

  return c.json(
    successResponse(monthly, "Monthly stats retrieved successfully"),
    HttpStatusCodes.OK,
  );
});

// Get all users (admin)
admin.get(
  "/users",
  getAllUsersDoc,
  validator("query", ListUsersQuerySchema, validationHook),
  async (c) => {
    try {
      const query = c.req.valid("query");

      const users = await auth.api.listUsers({
        query,
        headers: c.req.raw.headers,
      });

      return c.json(
        successResponse(users, "Users retrieved successfully"),
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

// Get user by ID (admin)
admin.get(
  "/users/:id",
  getUserDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");

      const user = await getUserById(id);

      if (!user) {
        return c.json(
          errorResponse("NOT_FOUND", "User not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

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
  },
);

// Get all orders (admin)
admin.get(
  "/orders",
  getAdminOrdersDoc,
  validator("query", PaginationQuerySchema, validationHook),
  async (c) => {
    try {
      const { page, limit } = c.req.valid("query");
      const { orders: allOrders, total } = await getAllOrders(page, limit);

      const pagination = buildPagination(page, limit, total);

      return c.json(
        successResponse(allOrders, "Orders retrieved successfully", pagination),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error retrieving orders:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve orders"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

// Get order by ID (admin)
admin.get(
  "/orders/:id",
  getAdminOrderDoc,
  validator("param", UuidParamSchema, validationHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const orderWithItems = await getAdminOrderById(id);

      if (!orderWithItems) {
        return c.json(
          errorResponse("NOT_FOUND", "Order not found"),
          HttpStatusCodes.NOT_FOUND,
        );
      }

      return c.json(
        successResponse(orderWithItems, "Order retrieved successfully"),
        HttpStatusCodes.OK,
      );
    } catch (error) {
      console.error("Error retrieving order:", error);
      return c.json(
        errorResponse("INTERNAL_SERVER_ERROR", "Failed to retrieve order"),
        HttpStatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  },
);

const createUserBodySchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(["user", "admin"]),
});

// Create new user (admin)
admin
  .use(permit({ user: ["create"] }))
  .post(
    "/users",
    createUserDoc,
    validator("json", createUserBodySchema, validationHook),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const user = await createUser(body);
        return c.json(
          successResponse(user, "User created successfully"),
          HttpStatusCodes.CREATED,
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

export default admin;
