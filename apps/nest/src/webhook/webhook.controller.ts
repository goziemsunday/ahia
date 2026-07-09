import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Post,
  type RawBodyRequest,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import type { Stripe } from "stripe";

import { sendOrderReceiptEmail } from "../lib/email";
import env from "../lib/env";
import { OrdersService } from "../orders/orders.service";
import { restoreStock } from "../orders/orders.utils";
import { getOrderIdFromSession, verifyAndParseWebhook } from "./webhook.utils";

@Controller("webhooks/stripe")
export class WebhookController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers["stripe-signature"] as string | undefined;

    if (!signature) {
      console.error("[Stripe Webhook] Missing stripe-signature header");
      throw new BadRequestException("Missing stripe-signature header");
    }

    // read raw body directly from the underlying request
    // const body = (req as unknown as { rawBody?: string }).rawBody as string;
    const body = req.rawBody?.toString("utf-8") as string;

    let event: Stripe.Event;
    try {
      event = verifyAndParseWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Stripe Webhook] Verification failed: ${message}`);
      throw new BadRequestException("Invalid webhook signature");
    }

    console.log(`[Stripe Webhook] Verified event: ${event.type} [${event.id}]`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const orderId = getOrderIdFromSession(session);

          if (!orderId) {
            console.error(
              "[Stripe Webhook] checkout.session.completed: no order ID in session",
            );
            break;
          }

          const order = await this.ordersService.getOneById(orderId);
          if (!order) {
            console.error(
              `[Stripe Webhook] Order ${orderId} not found in database`,
            );
            break;
          }

          await this.ordersService.updateStatus(
            order.id,
            "completed",
            "paid",
            session.payment_method_types?.[0] || "card",
          );

          if (order.userId) {
            await this.ordersService.clearCartByUserId(order.userId);
          }

          // send receipt email (fire and forget so the webhook response isnt blocked)
          const updatedOrder = await this.ordersService.getOneById(orderId);
          if (updatedOrder) {
            sendOrderReceiptEmail(
              updatedOrder,
              session.customer_details?.name ?? undefined,
            ).catch((err) => {
              console.error(
                "[Stripe Webhook] Failed to send receipt email:",
                err,
              );
            });
          }

          console.log(
            `[Stripe Webhook] Order ${order.orderNumber} marked as paid and completed`,
          );
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object;
          const orderId = getOrderIdFromSession(session);
          if (!orderId) break;

          const order = await this.ordersService.getOneById(orderId);
          if (!order) break;

          await this.ordersService.updateStatus(
            order.id,
            "cancelled",
            "failed",
          );
          await restoreStock(
            order.orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          );

          console.log(
            `[Stripe Webhook] Order ${order.orderNumber}: expired, stock restored`,
          );
          break;
        }

        case "checkout.session.async_payment_failed": {
          const session = event.data.object;
          const orderId = getOrderIdFromSession(session);
          if (!orderId) break;

          const order = await this.ordersService.getOneById(orderId);
          if (!order) break;

          await this.ordersService.updateStatus(
            order.id,
            "cancelled",
            "failed",
          );
          await restoreStock(
            order.orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          );

          console.log(
            `[Stripe Webhook] Order ${order.orderNumber}: payment failed, stock restored`,
          );
          break;
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
      }
    } catch (err) {
      console.error(`[Stripe Webhook] Error processing ${event.type}:`, err);
      throw new InternalServerErrorException("Webhook handler failed");
    }

    return { received: true };
  }
}
