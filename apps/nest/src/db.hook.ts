import { Injectable } from "@nestjs/common";
import { AfterCreate, DatabaseHook } from "@thallesp/nestjs-better-auth";
import type { User } from "better-auth";

import { CartService } from "./cart/cart.service";

@DatabaseHook()
@Injectable()
export class UserCreateHook {
  constructor(private readonly cartService: CartService) {}

  @AfterCreate("user")
  async afterUserCreate(user: User) {
    await this.cartService.createCart(user.id);
  }
}
