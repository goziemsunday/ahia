import { applyDecorators } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export class ApiErrorDto extends createZodDto(
  z.object({ error: z.object({ details: z.string() }) }),
) {}

type ApiErrorSpec = {
  description: string;
  example?: { error: { details: string } };
};

const BASE_ERRORS: Record<number, ApiErrorSpec> = {
  429: {
    description: "Too many requests have been made. Please try again later.",
  },
  500: { description: "Internal server error" },
};

const DEFAULT_DESCRIPTIONS: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  422: "Unprocessable entity",
};

export const ApiErrors = (errors: number[] | Record<number, ApiErrorSpec>) => {
  const userSpecs: Record<number, ApiErrorSpec> = Array.isArray(errors)
    ? Object.fromEntries(
        errors.map((code) => [
          code,
          { description: DEFAULT_DESCRIPTIONS[code] ?? "Error" },
        ]),
      )
    : { ...errors };

  for (const [code, spec] of Object.entries(BASE_ERRORS)) {
    if (!userSpecs[Number(code)]) userSpecs[Number(code)] = spec;
  }

  return applyDecorators(
    ApiExtraModels(ApiErrorDto),
    ...Object.entries(userSpecs)
      .toSorted(([a], [b]) => Number(a) - Number(b))
      .map(([status, spec]) =>
        ApiResponse({
          status: Number(status),
          description: spec.description,
          schema: {
            ...(spec.example ? { example: spec.example } : {}),
            allOf: [{ $ref: getSchemaPath(ApiErrorDto) }],
          },
        }),
      ),
  );
};
