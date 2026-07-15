import { $apiFetchAndThrow } from "@/lib/fetch";
import { successResSchema } from "@/lib/schemas";

import { CartResponseDataSchema } from "../cart/schema";

// ── Add To Cart ──────────────────────────────────────────────

export const addToCart = async ({
  productId,
  quantity,
}: {
  productId: string;
  quantity: number;
}) => {
  return await $apiFetchAndThrow("/cart/items", {
    method: "POST",
    body: { productId, quantity },
    output: successResSchema(CartResponseDataSchema),
  });
};
