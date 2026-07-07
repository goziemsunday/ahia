import { z } from "zod";

import { ProductExtendedSchema } from "@repo/db/validators/product.validator";

import { ShopQuerySchema } from "./products.dto";

export type ProductWithRelations = z.infer<typeof ProductExtendedSchema>;
export type ShopQueryType = z.infer<typeof ShopQuerySchema>;
