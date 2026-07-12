import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { AuthService, UserHasPermission } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import { UserWithRole } from "better-auth/plugins";
import type { Request } from "express";

import { User } from "@repo/db/schemas/auth.schema";

import { PaginationQueryDto, UuidParamDto } from "../common/dto/shared.dto";
import { auth } from "../lib/auth";
import { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import { OrderWithItemsAndCustomer } from "../orders/orders.types";
import { CreateUserBodyDto, ListUsersQueryDto } from "./admin.dto";
import { AdminService } from "./admin.service";
import { MonthlyStats, OverallStats } from "./admin.types";

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
  async getStats(): Promise<SuccessRes<OverallStats>> {
    const stats = await this.adminService.getOverviewStats();
    return successResponse(stats);
  }

  @Get("stats/monthly")
  async getMonthlyStats(): Promise<SuccessRes<MonthlyStats[]>> {
    const monthly = await this.adminService.getMonthlyStats();
    return successResponse(monthly);
  }

  @Get("users")
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
  async getUserById(@Param() param: UuidParamDto): Promise<SuccessRes<User>> {
    const user = await this.adminService.getUserById(param.id);
    return successResponse(user);
  }

  @Get("orders")
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
  async getOrderById(
    @Param() param: UuidParamDto,
  ): Promise<SuccessRes<OrderWithItemsAndCustomer>> {
    const order = await this.adminService.getOrderById(param.id);
    return successResponse(order);
  }

  @Post("users")
  @UserHasPermission({ permission: { user: ["create"] } })
  async createNewUser(
    @Body() body: CreateUserBodyDto,
  ): Promise<SuccessRes<User>> {
    const user = await this.adminService.createNewUser(body);
    return successResponse(user);
  }
}
