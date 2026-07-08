import { z } from "zod";

import { ProductExtendedSchema } from "@repo/db/validators/product.validator";

import { InStockSchema } from "./product.validators";
import { ShopQuerySchema } from "./products.dto";

export type ProductWithRelations = z.infer<typeof ProductExtendedSchema>;
export type ShopQueryType = z.infer<typeof ShopQuerySchema>;
export type InStockItem = z.infer<typeof InStockSchema>;
export type UploadedImage = { url: string; key: string };
