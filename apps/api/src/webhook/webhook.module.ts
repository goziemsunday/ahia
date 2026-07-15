import { Module } from "@nestjs/common";

import { OrdersModule } from "../orders/orders.module";
import { WebhookController } from "./webhook.controller";

@Module({
  imports: [OrdersModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
