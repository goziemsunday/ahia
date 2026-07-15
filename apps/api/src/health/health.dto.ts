import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const HealthResponseSchema = z.object({
  status: z.literal("OK"),
});

export class HealthDto extends createZodDto(HealthResponseSchema) {}
