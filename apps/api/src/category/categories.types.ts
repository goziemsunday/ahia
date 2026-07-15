import { z } from "zod";

import {
  CategoryExtendedSchema,
  CategorySelectSchema,
  CategoryWithCountSchema,
} from "@repo/db/validators/product.validator";

export type Category = z.infer<typeof CategorySelectSchema>;
export type CategoryWithCount = z.infer<typeof CategoryWithCountSchema>;
export type CategoryWithProducts = z.infer<typeof CategoryExtendedSchema>;
