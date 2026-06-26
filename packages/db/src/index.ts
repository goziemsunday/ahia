import { drizzle } from "drizzle-orm/node-postgres";

import env from "./lib/env";
import * as authSchema from "./schemas/auth.schema";
import * as cartSchema from "./schemas/cart.schema";
import * as orderSchema from "./schemas/order.schema";
import * as productSchema from "./schemas/product.schema";

const db = drizzle(env.DATABASE_URL!, {
  schema: {
    ...authSchema,
    ...productSchema,
    ...cartSchema,
    ...orderSchema,
  },
  casing: "snake_case",
});

export * from "drizzle-orm";
export { db };
