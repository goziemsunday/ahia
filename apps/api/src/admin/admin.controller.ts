import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthService, UserHasPermission } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { UserWithRole } from "better-auth/plugins";
import type { Request } from "express";

import type { User } from "@repo/db/schemas/auth.schema";

import { ApiErrors } from "../common/decorators/api-error-res.decorator";
import {
  ApiCreatedRes,
  ApiSuccessRes,
  ApiSuccessResPaginated,
} from "../common/decorators/api-success-res.decorator";
import { PaginationQueryDto, UuidParamDto } from "../common/dto/shared.dto";
import { auth } from "../lib/auth";
import type { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import { OrderWithCustomerDto } from "../orders/orders.dto";
import type { OrderWithItemsAndCustomer } from "../orders/orders.types";
import { UserDto } from "../user/user.dto";
import {
  AdminStatsDto,
  AdminUsersListResponseDto,
  CreateUserBodyDto,
  ListUsersQueryDto,
  MonthlyStatsDto,
} from "./admin.dto";
import { AdminService } from "./admin.service";
import type { MonthlyStats, OverallStats } from "./admin.types";

@ApiTags("Admin")
@ApiBearerAuth()
@Controller("admin")
@UserHasPermission({
  permission: { user: ["list"], order: ["view-user", "view-all"] },
})
export class AdminController {
  constructor(
    private adminService: AdminService,
    private authService: AuthService<typeof auth>,
  ) {}

  @Get("stats")
  @ApiOperation({ description: "Get admin overview stats" })
  @ApiSuccessRes({
    model: AdminStatsDto,
    description: "Admin dashboard overview stats",
  })
  @ApiErrors({
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description:
        "Insufficient permissions: missing user:list or order:view-all permission",
    },
  })
  async getStats(): Promise<SuccessRes<OverallStats>> {
    const stats = await this.adminService.getOverviewStats();
    return successResponse(stats);
  }

  @Get("stats/monthly")
  @ApiOperation({
    description: "Get monthly aggregated stats for the last 12 months",
  })
  @ApiSuccessRes({
    model: MonthlyStatsDto,
    isArray: true,
    description: "Monthly stats for charts",
  })
  @ApiErrors({
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description:
        "Insufficient permissions: missing user:list or order:view-all permission",
    },
  })
  async getMonthlyStats(): Promise<SuccessRes<MonthlyStats[]>> {
    const monthly = await this.adminService.getMonthlyStats();
    return successResponse(monthly);
  }

  @Get("users")
  @ApiOperation({ description: "Get all users (admin only)" })
  @ApiSuccessRes({
    model: AdminUsersListResponseDto,
    description: "Paginated list of users",
  })
  @ApiErrors({
    400: {
      description: "Invalid query parameters",
      example: { error: { details: "limit: Expected number, received NaN" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description: "Insufficient permissions: missing user:list permission",
    },
  })
  async getAllUsers(
    @Req() req: Request,
    @Query() query: ListUsersQueryDto,
  ): Promise<SuccessRes<{ users: UserWithRole[]; total: number }>> {
    const response = await this.authService.api.listUsers({
      query,
      headers: fromNodeHeaders(req.headers),
    });
    return successResponse(response);
  }

  @Get("users/:id")
  @ApiOperation({ description: "Get a user by id (admin only)" })
  @ApiSuccessRes({
    model: UserDto,
    description: "Single user by ID",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description: "Insufficient permissions: missing user:list permission",
    },
    404: {
      description: "User not found",
      example: { error: { details: "User not found" } },
    },
  })
  async getUserById(@Param() param: UuidParamDto): Promise<SuccessRes<User>> {
    const user = await this.adminService.getUserById(param.id);
    return successResponse(user);
  }

  @Get("orders")
  @ApiOperation({ description: "Get all orders (admin only)" })
  @ApiSuccessResPaginated({
    model: OrderWithCustomerDto,
    isArray: true,
    description: "Paginated list of all orders",
  })
  @ApiErrors({
    400: {
      description: "Invalid pagination parameters",
      example: { error: { details: "page: Expected number, received NaN" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description:
        "Insufficient permissions: missing order:view-all permission",
    },
  })
  async getAllOrders(
    @Query() query: PaginationQueryDto,
  ): Promise<SuccessRes<OrderWithItemsAndCustomer[]>> {
    const { orders, total } = await this.adminService.getAllOrders(
      query.page,
      query.limit,
    );
    const pagination = buildPagination(query.page, query.limit, total);

    return successResponse(orders, pagination);
  }

  @Get("orders/:id")
  @ApiOperation({ description: "Get order by ID (admin only)" })
  @ApiSuccessRes({
    model: OrderWithCustomerDto,
    description: "Single order by ID",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description:
        "Insufficient permissions: missing order:view-all permission",
    },
    404: {
      description: "Order not found",
      example: { error: { details: "Order not found" } },
    },
  })
  async getOrderById(
    @Param() param: UuidParamDto,
  ): Promise<SuccessRes<OrderWithItemsAndCustomer>> {
    const order = await this.adminService.getOrderById(param.id);
    return successResponse(order);
  }

  @Post("users")
  @ApiOperation({ description: "Create a new user account (admin only)" })
  @ApiCreatedRes({
    model: UserDto,
    description: "User created by admin",
  })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: {
        error: {
          details:
            "name: Required; email: Invalid email; role: Invalid enum value. Expected 'user' or 'admin'",
        },
      },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description: "Insufficient permissions: missing user:create permission",
    },
  })
  @UserHasPermission({ permission: { user: ["create"] } })
  async createNewUser(
    @Body() body: CreateUserBodyDto,
  ): Promise<SuccessRes<User>> {
    const user = await this.adminService.createNewUser(body);
    return successResponse(user);
  }
}
