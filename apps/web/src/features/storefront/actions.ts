"use server";

import { CartSelectSchema } from "@repo/db/validators/cart.validator";

import { getAuthHeaders } from "@/lib/auth";
import { $fetchAndThrow } from "@/lib/fetch";
import { successResSchema } from "@/lib/schemas";

// ── Add To Cart ──────────────────────────────────────────────

export const addToCart = async ({
  productId,
  quantity,
}: {
  productId: string;
  quantity: number;
}) => {
  return await $fetchAndThrow("/cart/items", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: { productId, quantity },
    output: successResSchema(CartSelectSchema),
  });
};
