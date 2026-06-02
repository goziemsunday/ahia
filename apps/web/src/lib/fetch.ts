import { createFetch } from "@better-fetch/fetch";

import { errorResSchema } from "@/lib/schemas";

import env from "./env";

const baseURL =
  typeof window === "undefined"
    ? `${env.API_URL}/api`
    : `${env.NEXT_PUBLIC_API_URL}/api`;

export const $fetch = createFetch({
  baseURL,
  credentials: "include",
  errorSchema: errorResSchema,
});

export const $fetchAndThrow = createFetch({
  baseURL,
  throw: true,
  credentials: "include",
  errorSchema: errorResSchema,
});
