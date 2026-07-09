import { Module } from "@nestjs/common";

import { CartService } from "../cart/cart.service";
import { ProductsService } from "../product/products.service";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [CartService, ProductsService],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
