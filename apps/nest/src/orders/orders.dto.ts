import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class VerifySessionDto extends createZodDto(
  z.object({ sessionId: z.string() }),
) {}
