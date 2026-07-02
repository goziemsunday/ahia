import { BetterFetchError } from "@better-fetch/fetch";

import { UserSelectSchema } from "@repo/db/validators/user.validator";

import { $fetchAndThrow } from "@/lib/fetch";
import { errorResSchema, successResSchema } from "@/lib/schemas";

export const getUser = async (cookie?: string) => {
  try {
    const { data } = await $fetchAndThrow("/user/me", {
      headers: cookie ? { cookie } : undefined,
      output: successResSchema(UserSelectSchema),
    });

    return data ?? null;
  } catch (error) {
    if (error instanceof BetterFetchError) {
      const parsed = errorResSchema.safeParse(error.error);

      if (error.status === 401) {
        return null;
      }

      throw new Error(
        parsed.success
          ? parsed.data.error.details
          : "Failed to fetch current user",
        { cause: error },
      );
    }

    throw error;
  }
};
