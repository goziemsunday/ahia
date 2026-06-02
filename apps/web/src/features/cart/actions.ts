"use server";

import { z } from "zod";

import { CartSelectSchema } from "@repo/db/validators/cart.validator";
import { OrderSelectSchema } from "@repo/db/validators/order.validator";

import { getAuthHeaders } from "@/lib/auth";
import { $fetch, $fetchAndThrow } from "@/lib/fetch";
import { successResSchema } from "@/lib/schemas";

const cartOutputSchema = successResSchema(CartSelectSchema);

type CartResponse = z.infer<typeof CartSelectSchema>;

export const getCart = async (): Promise<CartResponse | null> => {
  const { data, error } = await $fetch("/cart", {
    headers: await getAuthHeaders(),
    output: cartOutputSchema,
  });

  if (error) {
    console.error(error);
    return null;
  }

  return data?.data ?? null;
};

export const updateCartItemQuantity = async ({
  itemId,
  quantity,
}: {
  itemId: string;
  quantity: number;
}) => {
  return await $fetchAndThrow(`/cart/items/${itemId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: { quantity },
    output: cartOutputSchema,
  });
};

export const removeCartItem = async (itemId: string) => {
  return await $fetchAndThrow(`/cart/items/${itemId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    output: cartOutputSchema,
  });
};

export const clearCart = async () => {
  return await $fetchAndThrow("/cart", {
    method: "DELETE",
    headers: await getAuthHeaders(),
    output: cartOutputSchema,
  });
};

export const createCheckout = async () => {
  return await $fetchAndThrow("/orders/create-checkout", {
    method: "POST",
    headers: await getAuthHeaders(),
    output: successResSchema(
      z.object({
        checkoutUrl: z.url(),
        checkoutSessionId: z.string(),
      }),
    ),
  });
};

export const verifyCheckoutSession = async (sessionId: string) => {
  return await $fetchAndThrow("/orders/verify-session", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: { sessionId },
    output: successResSchema(OrderSelectSchema),
  });
};
