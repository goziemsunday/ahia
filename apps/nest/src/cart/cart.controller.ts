import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

import { UuidParamDto } from "../common/dto/shared.dto";
import { SuccessRes } from "../lib/types";
import { successResponse } from "../lib/utils";
import { AddToCartDto, UpdateCartItemDto } from "./cart.dto";
import { CartService } from "./cart.service";
import { CartResponse } from "./cart.types";

@Controller("cart")
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  async getCart(
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const cart = await this.cartService.getCart(session.user.id);
    return successResponse(cart);
  }

  @Post("items")
  async addItem(
    @Body() body: AddToCartDto,
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const updatedCart = await this.cartService.addItem(session.user.id, body);
    return successResponse(updatedCart);
  }

  @Put("items/:id")
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
  async clear(
    @Session() session: UserSession,
  ): Promise<SuccessRes<CartResponse>> {
    const clearedCart = await this.cartService.clearCart(session.user.id);
    return successResponse(clearedCart);
  }
}
