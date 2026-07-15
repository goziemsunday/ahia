import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { ApiErrors } from "../common/decorators/api-error-res.decorator";
import {
  ApiCreatedRes,
  ApiSuccessRes,
  ApiSuccessResPaginated,
} from "../common/decorators/api-success-res.decorator";
import { PaginationQueryDto, UuidParamDto } from "../common/dto/shared.dto";
import type { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import {
  CheckoutResponseDto,
  OrderWithItemsDto,
  VerifySessionDto,
} from "./orders.dto";
import { OrdersService } from "./orders.service";
import type { CheckoutResponse, OrderWithItems } from "./orders.types";

@ApiTags("Orders")
@ApiBearerAuth()
@Controller("order")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ description: "Get user's order history" })
  @ApiSuccessResPaginated({
    model: OrderWithItemsDto,
    isArray: true,
    description: "Current user's orders",
  })
  @ApiErrors({
    400: {
      description: "Invalid pagination parameters",
      example: { error: { details: "page: Expected number, received NaN" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
  })
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
  @ApiOperation({ description: "Get user's order details" })
  @ApiSuccessRes({
    model: OrderWithItemsDto,
    description: "Single order by ID",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    404: {
      description: "Order not found",
      example: { error: { details: "Order not found" } },
    },
  })
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
  @ApiOperation({
    description: "Create a Stripe checkout session for the user's cart",
  })
  @ApiCreatedRes({
    model: CheckoutResponseDto,
    description: "Stripe checkout session created",
  })
  @ApiErrors({
    400: {
      description: "Cart is empty",
      example: {
        error: {
          details: "Cart is empty. Add items to cart before creating order.",
        },
      },
    },
    401: { description: "Not authenticated: no or invalid session" },
    422: {
      description: "Product unavailable or insufficient stock",
      example: {
        error: {
          details: 'Not enough stock for "T-Shirt". Requested: 3, Available: 1',
        },
      },
    },
    500: {
      description: "Failed to create checkout session",
      example: { error: { details: "Failed to retrieve created order" } },
    },
  })
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
  @ApiOperation({
    description: "Verify a Stripe checkout session and update order status",
  })
  @ApiCreatedRes({
    model: OrderWithItemsDto,
    description: "Stripe session verified",
  })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: { error: { details: "sessionId: Required" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    404: {
      description: "Session or order not found",
      example: { error: { details: "Checkout session not found" } },
    },
    500: {
      description: "Failed to verify session",
      example: { error: { details: "Failed to retrieve updated order" } },
    },
  })
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
