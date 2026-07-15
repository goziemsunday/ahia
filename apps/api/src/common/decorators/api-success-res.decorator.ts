import { applyDecorators, type Type } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  getSchemaPath,
  type ApiResponseOptions,
} from "@nestjs/swagger";

type ApiSuccessResOptions<TModel extends Type> = {
  model: TModel;
  isArray?: boolean;
  description?: string;
  example?: unknown;
  examples?: Record<string, { value: unknown; summary?: string }>;
  headers?: ApiResponseOptions["headers"];
  links?: ApiResponseOptions["links"];
};

// SCHEMA BUILDERS

const buildSchemaRef = (model: Type, isArray: boolean) =>
  isArray
    ? { type: "array" as const, items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

const buildDataSchema = (model: Type, isArray: boolean) => ({
  type: "object" as const,
  required: ["data"],
  properties: {
    data: buildSchemaRef(model, isArray),
  },
});

const buildPaginatedSchema = (model: Type, isArray: boolean) => ({
  type: "object" as const,
  required: ["data"],
  properties: {
    data: buildSchemaRef(model, isArray),
    pagination: {
      type: "object" as const,
      properties: {
        page: { type: "integer" },
        limit: { type: "integer" },
        total: { type: "integer" },
        totalPages: { type: "integer" },
      },
      required: ["page", "limit", "total", "totalPages"],
    },
  },
});

const buildOptions = <TModel extends Type>(
  schema: ReturnType<typeof buildDataSchema>,
  opts: ApiSuccessResOptions<TModel>,
): ApiResponseOptions => ({
  description: opts.description,
  schema: {
    ...schema,
    ...(opts.example ? { example: opts.example } : {}),
    ...(opts.examples ? { examples: opts.examples } : {}),
  },
  ...(opts.headers ? { headers: opts.headers } : {}),
  ...(opts.links ? { links: opts.links } : {}),
});

// OK

export const ApiSuccessRes = <TModel extends Type>(
  opts: ApiSuccessResOptions<TModel>,
) =>
  applyDecorators(
    ApiExtraModels(opts.model),
    ApiOkResponse(
      buildOptions(buildDataSchema(opts.model, opts.isArray ?? false), opts),
    ),
  );

export const ApiSuccessResPaginated = <TModel extends Type>(
  opts: ApiSuccessResOptions<TModel>,
) =>
  applyDecorators(
    ApiExtraModels(opts.model),
    ApiOkResponse(
      buildOptions(
        buildPaginatedSchema(opts.model, opts.isArray ?? false),
        opts,
      ),
    ),
  );

// CREATED

export const ApiCreatedRes = <TModel extends Type>(
  opts: ApiSuccessResOptions<TModel>,
) =>
  applyDecorators(
    ApiExtraModels(opts.model),
    ApiCreatedResponse(
      buildOptions(buildDataSchema(opts.model, opts.isArray ?? false), opts),
    ),
  );

export const ApiCreatedResPaginated = <TModel extends Type>(
  opts: ApiSuccessResOptions<TModel>,
) =>
  applyDecorators(
    ApiExtraModels(opts.model),
    ApiCreatedResponse(
      buildOptions(
        buildPaginatedSchema(opts.model, opts.isArray ?? false),
        opts,
      ),
    ),
  );
