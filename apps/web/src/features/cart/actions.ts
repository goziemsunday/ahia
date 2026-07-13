"use server";

import { z } from "zod";

import { OrderSelectSchema } from "@repo/db/validators/order.validator";

import { getAuthHeaders } from "@/lib/auth";
import { $apiFetchAndThrow, $fetch } from "@/lib/fetch";
import { successResSchema } from "@/lib/schemas";

import { CartResponseDataSchema } from "./schema";

const cartOutputSchema = successResSchema(CartResponseDataSchema);

type CartResponse = z.infer<typeof CartResponseDataSchema>;

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
  return await $apiFetchAndThrow(`/cart/items/${itemId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: { quantity },
    output: cartOutputSchema,
  });
};

export const removeCartItem = async (itemId: string) => {
  return await $apiFetchAndThrow(`/cart/items/${itemId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    output: cartOutputSchema,
  });
};

export const clearCart = async () => {
  return await $apiFetchAndThrow("/cart", {
    method: "DELETE",
    headers: await getAuthHeaders(),
    output: cartOutputSchema,
  });
};

export const createCheckout = async () => {
  return await $apiFetchAndThrow("/orders/create-checkout", {
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
  return await $apiFetchAndThrow("/orders/verify-session", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: { sessionId },
    output: successResSchema(OrderSelectSchema),
  });
};
