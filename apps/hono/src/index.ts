import { Hono } from "hono";

import { createApp } from "@/app";
import { createSuperadmin } from "@/queries/admin-queries";
import admin from "@/routes/admin/admin.route";
import cart from "@/routes/cart/cart.route";
import categories from "@/routes/categories/categories.route";
import health from "@/routes/health/health.route";
import orders from "@/routes/orders/orders.route";
import products from "@/routes/products/products.route";
import stripeWebhook from "@/routes/stripe/stripe.route";
import user from "@/routes/user/user.route";

import env from "./lib/env";

// Bare Hono app for Stripe webhooks
const webhookApp = new Hono();
webhookApp.route("/api/webhooks/stripe", stripeWebhook);

// Main app with full middleware
const app = createApp();
app
  .route("/api/health", health)
  .route("/api/user", user)
  .route("/api/admin", admin)
  .route("/api/categories", categories)
  .route("/api/products", products)
  .route("/api/orders", orders)
  .route("/api/cart", cart);

// Create superadmin if not exists
if (env.NODE_ENV !== "test") {
  createSuperadmin()
    .then(() => console.log("Superadmin check completed"))
    .catch((err) => {
      console.error("Failed to check/create superadmin:", err);
    });
}

export default {
  port: 8000,
  fetch: (req: Request, server: unknown) => {
    // Route webhook requests
    if (new URL(req.url).pathname.startsWith("/api/webhooks/")) {
      return webhookApp.fetch(req);
    }
    return app.fetch(req, server);
  },
};
