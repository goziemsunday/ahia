import { type InferSelectModel, relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { timestamps } from "../lib/helpers";
// oxlint-disable-next-line import/no-cycle
import { user } from "./auth.schema";
import { cartItem } from "./cart.schema";
import { orderItem } from "./order.schema";

export const product = pgTable("product", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").default(0),
  sizes: jsonb("sizes")
    .$type<{ name: string; inStock: boolean }[]>()
    .default([])
    .notNull(),
  colors: jsonb("colors")
    .$type<{ name: string; inStock: boolean }[]>()
    .default([])
    .notNull(),
  images: jsonb("images")
    .$type<{ url: string; key: string }[]>()
    .default([])
    .notNull(),
  // `restrict` prevents deleting a user who has created products. This is
  // the safe default for a financial record: admins should transfer ownership
  // manually if needed. The prior `set null` was contradictory with `.notNull()`
  // (Postgres would reject the `set null` on a not-null column anyway).
  createdBy: uuid("created_by")
    .notNull()
    .references(() => user.id, {
      onDelete: "restrict",
    }),
  ...timestamps,
});
export const productRelations = relations(product, ({ one, many }) => ({
  creator: one(user, {
    fields: [product.createdBy],
    references: [user.id],
  }),
  cartItems: many(cartItem),
  productCategories: many(productCategory),
  orderItems: many(orderItem),
}));

export const category = pgTable("category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  ...timestamps,
});
export const categoryRelations = relations(category, ({ many }) => ({
  productCategories: many(productCategory),
}));

export const productCategory = pgTable("product_category", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
});
export const productCategoryRelations = relations(
  productCategory,
  ({ one }) => ({
    product: one(product, {
      fields: [productCategory.productId],
      references: [product.id],
    }),
    category: one(category, {
      fields: [productCategory.categoryId],
      references: [category.id],
    }),
  }),
);

export type Product = InferSelectModel<typeof product>;
export type Category = InferSelectModel<typeof category>;
