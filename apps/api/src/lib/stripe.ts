// oxlint-disable-next-line import/no-named-as-default
import Stripe from "stripe";

import env from "./env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-05-27.dahlia",
  typescript: true,
});
