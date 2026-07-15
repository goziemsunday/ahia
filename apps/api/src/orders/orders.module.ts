import { Module } from "@nestjs/common";

import { CartModule } from "../cart/cart.module";
import { ProductsModule } from "../product/products.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [CartModule, ProductsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
