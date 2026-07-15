import { z } from "zod";

import {
  ChangePasswordSchema,
  UserUpdateSchema,
} from "@repo/db/validators/user.validator";

import { $apiFetchAndThrow } from "@/lib/fetch";
import { successResSchema } from "@/lib/schemas";

export const updateUser = async (body: z.infer<typeof UserUpdateSchema>) => {
  const { data: response } = await $apiFetchAndThrow("/user/me", {
    method: "PATCH",
    body,
    output: successResSchema(
      z.object({
        status: z.literal(true),
      }),
    ),
  });

  return response;
};

export const changePassword = async (
  body: z.infer<typeof ChangePasswordSchema>,
) => {
  const { data: response } = await $apiFetchAndThrow("/user/me/password", {
    method: "POST",
    body,
    output: successResSchema(
      z.object({
        status: z.literal(true),
      }),
    ),
  });

  return response;
};
