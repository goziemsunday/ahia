import { drizzle } from "drizzle-orm/node-postgres";

import env from "./lib/env";
import * as authSchema from "./schemas/auth.schema";
import * as cartSchema from "./schemas/cart.schema";
import * as orderSchema from "./schemas/order.schema";
import * as productSchema from "./schemas/product.schema";

const schema = {
  ...authSchema,
  ...productSchema,
  ...cartSchema,
  ...orderSchema,
};

const db = drizzle(env.DATABASE_URL, {
  schema,
  casing: "snake_case",
});

/**
 * Union type representing either the global `db` instance or a Drizzle
 * transaction object. The relational query builder (`db.query.*`) works
 * identically on both, so we accept the union and let the caller decide
 * whether to read inside a transaction or outside.
 */
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export * from "drizzle-orm";
export { db };
export type { DbOrTx };
