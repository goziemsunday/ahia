import { z } from "zod";

import {
  CreateCheckoutResponseSchema,
  OrderSelectSchema,
  OrderWithCustomerSelectSchema,
} from "@repo/db/validators/order.validator";

export type OrderWithItems = z.infer<typeof OrderSelectSchema>;
export type OrderWithItemsAndCustomer = z.infer<
  typeof OrderWithCustomerSelectSchema
>;
export type CheckoutResponse = z.infer<typeof CreateCheckoutResponseSchema>;
