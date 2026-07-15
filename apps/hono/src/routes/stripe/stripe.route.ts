import { createHmac } from "crypto";

import { Hono } from "hono";
// oxlint-disable-next-line import/no-named-as-default
import type Stripe from "stripe";

import { sendOrderReceiptEmail } from "@/lib/email";
import env from "@/lib/env";
import { clearCartItemsByUserId } from "@/queries/cart-queries";
import {
  getOrderById,
  restoreStock,
  updateOrderStatus,
} from "@/queries/order-queries";

const stripeWebhook = new Hono();

/**
 * Extracts the order ID from a Stripe Checkout Session.
 * Uses client_reference_id (set during checkout creation) as primary,
 * with metadata.orderId as fallback.
 */
const getOrderIdFromSession = (
  session: Stripe.Checkout.Session,
): string | null => {
  return session.client_reference_id ?? session.metadata?.orderId ?? null;
};

/**
 * Manually verify Stripe webhook signature and parse event.
 * Bypasses the Stripe SDK's constructEvent which can have issues in Bun.
 */
const verifyAndParseWebhook = (
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Stripe.Event => {
  // Parse the signature header: "t=TIMESTAMP,v1=SIG1,v1=SIG2,..."
  const parts = signatureHeader.split(",");
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    else if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid signature header format");
  }

  // Check timestamp tolerance
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > toleranceSeconds) {
    throw new Error(
      `Timestamp outside tolerance: event=${ts}, now=${now}, diff=${now - ts}s`,
    );
  }

  // Compute expected signature: HMAC-SHA256(timestamp.body, secret)
  const payload = `${timestamp}.${body}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  // Compare with all provided v1 signatures
  const isValid = signatures.some((sig) => {
    if (sig.length !== expectedSignature.length) return false;
    // Constant-time comparison
    let result = 0;
    for (let i = 0; i < sig.length; i++) {
      result |= sig.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  });

  if (!isValid) {
    throw new Error(
      "Signature mismatch. " +
        `Expected: ${expectedSignature.slice(0, 16)}..., ` +
        `Got: ${signatures[0]?.slice(0, 16)}...`,
    );
  }

  return JSON.parse(body) as Stripe.Event;
};

stripeWebhook.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  // Read raw body directly from the underlying Request
  const body = await c.req.raw.text();

  let event: Stripe.Event;
  try {
    event = verifyAndParseWebhook(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Stripe Webhook] Verification failed: ${message}`);
    return c.json({ error: "Invalid webhook signature" }, 400);
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

        console.log(
          `[Stripe Webhook] Processing payment success for order: ${orderId}`,
        );

        const order = await getOrderById(orderId);
        if (!order) {
          console.error(
            `[Stripe Webhook] Order ${orderId} not found in database`,
          );
          break;
        }

        await updateOrderStatus(
          order.id,
          "completed",
          "paid",
          session.payment_method_types?.[0] || "card",
        );

        if (order.userId) {
          await clearCartItemsByUserId(order.userId);
        }

        // Send receipt email (fire and forget so the webhook response isnt blocked)
        const updatedOrder = await getOrderById(orderId);
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

        const order = await getOrderById(orderId);
        if (!order) break;

        await updateOrderStatus(order.id, "cancelled", "failed");
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

        const order = await getOrderById(orderId);
        if (!order) break;

        await updateOrderStatus(order.id, "cancelled", "failed");
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
    return c.json({ error: "Webhook handler failed" }, 500);
  }

  return c.json({ received: true }, 200);
});

export default stripeWebhook;
