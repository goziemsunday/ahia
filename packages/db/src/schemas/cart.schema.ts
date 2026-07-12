import { relations, type InferSelectModel } from "drizzle-orm";
import { integer, pgTable, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "../lib/helpers";
// oxlint-disable-next-line import/no-cycle
import { user } from "./auth.schema";
import { product } from "./product.schema";

export const cart = pgTable("cart", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .unique()
    .notNull()
    .references(() => user.id, {
      onDelete: "cascade",
    }),
  ...timestamps,
});
export const cartRelations = relations(cart, ({ many, one }) => ({
  customer: one(user, {
    fields: [cart.userId],
    references: [user.id],
  }),
  cartItems: many(cartItem),
}));

export const cartItem = pgTable("cart_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => cart.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  ...timestamps,
});
export const cartItemRelations = relations(cartItem, ({ one }) => ({
  cart: one(cart, {
    fields: [cartItem.cartId],
    references: [cart.id],
  }),
  product: one(product, {
    fields: [cartItem.productId],
    references: [product.id],
  }),
}));

export type Cart = InferSelectModel<typeof cart>;
