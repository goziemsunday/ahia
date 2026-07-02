import { z } from "zod";

// ——————— FOR THE NEST APP ———————
export const successResSchema = <T>(data: z.ZodType<T>) =>
  z.object({
    data: data,
    pagination: z
      .object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
      })
      .optional(),
  });

export const errorResSchema = z.object({
  error: z.object({ details: z.string() }),
});

// ——————— FOR THE HONO APP ———————
// export const successResSchema = <T>(data: z.ZodType<T>) =>
//   z.object({
//     status: z.literal("success"),
//     details: z.string(),
//     data: data,
//     pagination: z
//       .object({
//         page: z.number(),
//         limit: z.number(),
//         total: z.number(),
//         totalPages: z.number(),
//       })
//       .optional(),
//   });

// export const errorResSchema = z.object({
//   status: z.literal("error"),
//   error: z.object({
//     code: z.string(),
//     details: z.string(),
//     fields: z.record(z.string(), z.string()),
//   }),
// });
