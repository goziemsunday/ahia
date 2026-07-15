import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import {
  CreateCheckoutResponseSchema,
  OrderSelectSchema,
  OrderWithCustomerSelectSchema,
} from "@repo/db/validators/order.validator";

// request dtos
export class VerifySessionDto extends createZodDto(
  z.object({ sessionId: z.string() }),
) {}

// response dtos
export class OrderWithItemsDto extends createZodDto(OrderSelectSchema) {}
export class OrderWithCustomerDto extends createZodDto(
  OrderWithCustomerSelectSchema,
) {}
export class CheckoutResponseDto extends createZodDto(
  CreateCheckoutResponseSchema,
) {}
