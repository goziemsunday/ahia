import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { ApiErrors } from "../common/decorators/api-error-res.decorator";
import {
  ApiCreatedRes,
  ApiSuccessRes,
} from "../common/decorators/api-success-res.decorator";
import { UuidParamDto } from "../common/dto/shared.dto";
import type { SuccessRes } from "../lib/types";
import { successResponse } from "../lib/utils";
import { AddToCartDto, CartResponseDto, UpdateCartItemDto } from "./cart.dto";
import { CartService } from "./cart.service";
import type { CartResponse } from "./cart.types";

@ApiTags("Cart")
@ApiBearerAuth()
@Controller("cart")
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @ApiOperation({ description: "Get user's cart" })
  @ApiSuccessRes({ model: CartResponseDto, description: "Current user's cart" })
  @ApiErrors({
    401: { description: "Not authenticated: no or invalid session" },
  })
  async getCart(
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const cart = await this.cartService.getCart(session.user.id);
    return successResponse(cart);
  }

  @Post("items")
  @ApiOperation({ description: "Add product to cart" })
  @ApiCreatedRes({
    model: CartResponseDto,
    description: "Item added to cart",
  })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: {
        error: {
          details:
            "productId: Invalid uuid; quantity: Expected number, received NaN",
        },
      },
    },
    401: { description: "Not authenticated: no or invalid session" },
    404: {
      description: "Product not found",
      example: { error: { details: "Product not found" } },
    },
    422: {
      description: "Insufficient stock",
      example: {
        error: {
          details:
            "Not enough stock available. Requested: 10, Available: 5. Maximum you can add: 5",
        },
      },
    },
  })
  async addItem(
    @Body() body: AddToCartDto,
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const updatedCart = await this.cartService.addItem(session.user.id, body);
    return successResponse(updatedCart);
  }

  @Put("items/:id")
  @ApiOperation({ description: "Update cart item quantity" })
  @ApiSuccessRes({
    model: CartResponseDto,
    description: "Cart item quantity updated",
  })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: {
        error: {
          details: "id: Invalid uuid; quantity: Expected number, received NaN",
        },
      },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description: "Cannot modify another user's cart item",
      example: {
        error: { details: "You can only update items in your own cart" },
      },
    },
    404: {
      description: "Cart item not found",
      example: { error: { details: "Cart item not found" } },
    },
    422: {
      description: "Insufficient stock",
      example: {
        error: {
          details: "Not enough stock available. Requested: 10, Available: 5",
        },
      },
    },
  })
  async updateItem(
    @Param() param: UuidParamDto,
    @Body() body: UpdateCartItemDto,
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const updatedCart = await this.cartService.updateItem(
      session.user.id,
      param.id,
      body,
    );
    return successResponse(updatedCart);
  }

  @Delete("items/:id")
  @ApiOperation({ description: "Delete cart item" })
  @ApiSuccessRes({
    model: CartResponseDto,
    description: "Cart item removed",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: {
      description: "Cannot remove another user's cart item",
      example: {
        error: { details: "You can only remove items from your own cart" },
      },
    },
    404: {
      description: "Cart item not found",
      example: { error: { details: "Cart item not found" } },
    },
  })
  async deleteItem(
    @Param() param: UuidParamDto,
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const updatedCart = await this.cartService.deleteItem(
      session.user.id,
      param.id,
    );
    return successResponse(updatedCart);
  }

  @Delete()
  @ApiOperation({ description: "Clear all items from cart" })
  @ApiSuccessRes({ model: CartResponseDto, description: "Cart cleared" })
  @ApiErrors({
    401: { description: "Not authenticated: no or invalid session" },
  })
  async clear(
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const clearedCart = await this.cartService.clearCart(session.user.id);
    return successResponse(clearedCart);
  }
}
