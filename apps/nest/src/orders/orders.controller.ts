import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { PaginationQueryDto, UuidParamDto } from "../common/dto/shared.dto";
import { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import { VerifySessionDto } from "./orders.dto";
import { OrdersService } from "./orders.service";
import { CheckoutResponse, OrderWithItems } from "./orders.types";

@Controller("order")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  async getAllForUser(
    @Query() query: PaginationQueryDto,
    @Session() session: UserSession,
  ): Promise<SuccessRes<OrderWithItems[]>> {
    const { orders, total } = await this.ordersService.getAllForUser(
      session.user.id,
      query.page,
      query.limit,
    );
    const pagination = buildPagination(query.page, query.limit, total);

    return successResponse(orders, pagination);
  }

  @Get(":id")
  async getOneForUser(
    @Param() param: UuidParamDto,
    @Session() session: UserSession,
  ): Promise<SuccessRes<OrderWithItems>> {
    const order = await this.ordersService.getOneForUser(
      param.id,
      session.user.id,
    );
    return successResponse(order);
  }

  @Post("create-checkout")
  async createCheckout(
    @Session() session: UserSession,
  ): Promise<SuccessRes<CheckoutResponse>> {
    const checkout = await this.ordersService.createCheckout(
      session.user.id,
      session.user.email,
    );
    return successResponse(checkout);
  }

  @Post("verify-session")
  async verifySession(
    @Body() body: VerifySessionDto,
    @Session() session: UserSession,
  ): Promise<SuccessRes<OrderWithItems>> {
    const updatedOrder = await this.ordersService.verifySession(
      session.user,
      body.sessionId,
    );
    return successResponse(updatedOrder);
  }
}
