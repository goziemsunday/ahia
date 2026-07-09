import { z } from "zod";

import {
  CreateCheckoutResponseSchema,
  OrderSelectSchema,
} from "@repo/db/validators/order.validator";

export type OrderWithItems = z.infer<typeof OrderSelectSchema>;
export type CheckoutResponse = z.infer<typeof CreateCheckoutResponseSchema>;
