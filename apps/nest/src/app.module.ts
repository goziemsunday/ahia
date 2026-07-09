import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";

import { CartModule } from "./cart/cart.module";
import { CategoriesModule } from "./category/categories.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { HealthModule } from "./health/health.module";
import { auth } from "./lib/auth";
import { OrdersModule } from "./orders/orders.module";
import { ProductsModule } from "./product/products.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    HealthModule,
    AuthModule.forRoot({
      auth,
      bodyParser: { rawBody: true },
    }),
    UserModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    OrdersModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
