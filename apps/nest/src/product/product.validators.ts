import { FileTypeValidator, MaxFileSizeValidator } from "@nestjs/common";
import { z } from "zod";

import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "../lib/file";

export const productImageValidators = [
  new MaxFileSizeValidator({
    maxSize: MAX_FILE_SIZE,
    errorMessage: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
  }),
  ...ALLOWED_FILE_TYPES.map(
    (type) =>
      new FileTypeValidator({
        fileType: type,
        errorMessage: `File type must be one of: ${ALLOWED_FILE_TYPES.join(", ")}`,
      }),
  ),
];

export const InStockSchema = z.object({
  name: z.string().min(1, { error: "Name is required" }),
  inStock: z.boolean(),
});
