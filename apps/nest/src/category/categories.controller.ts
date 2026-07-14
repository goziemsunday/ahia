import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  AllowAnonymous,
  UserHasPermission,
} from "@thallesp/nestjs-better-auth";

import { ApiErrors } from "../common/decorators/api-error-res.decorator";
import {
  ApiCreatedRes,
  ApiSuccessRes,
  ApiSuccessResPaginated,
} from "../common/decorators/api-success-res.decorator";
import {
  LimitQueryDto,
  PaginationQueryDto,
  UuidParamDto,
} from "../common/dto/shared.dto";
import type { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import {
  CategoryDto,
  CategoryWithCountDto,
  CategoryWithProductDto,
  CreateCategoryDto,
} from "./categories.dto";
import { CategoriesService } from "./categories.service";
import {
  Category,
  CategoryWithCount,
  CategoryWithProducts,
} from "./categories.types";

@Controller("categories")
@ApiTags("Categories")
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ description: "Get all categories" })
  @ApiSuccessResPaginated({
    model: CategoryWithCountDto,
    isArray: true,
    description: "All categories with product counts",
  })
  @ApiErrors({
    400: {
      description: "Invalid pagination parameters",
      example: { error: { details: "page: Expected number, received NaN" } },
    },
  })
  @AllowAnonymous()
  async getAll(
    @Query() query: PaginationQueryDto,
  ): Promise<SuccessRes<CategoryWithCount[]>> {
    const { categories, total } = await this.categoriesService.getAll(
      query.page,
      query.limit,
    );
    const pagination = buildPagination(query.page, query.limit, total);

    return successResponse(categories, pagination);
  }

  @Get("top")
  @ApiOperation({ description: "Get top categories by product count" })
  @ApiSuccessRes({
    model: CategoryWithCountDto,
    isArray: true,
    description: "Top categories limited by count",
  })
  @ApiErrors({
    400: {
      description: "Invalid limit parameter",
      example: { error: { details: "limit: Expected number, received NaN" } },
    },
  })
  @AllowAnonymous()
  async getTop(
    @Query() query: LimitQueryDto,
  ): Promise<SuccessRes<CategoryWithCount[]>> {
    const top = await this.categoriesService.getTop(query.limit);
    return successResponse(top);
  }

  @Get(":id")
  @ApiOperation({ description: "Get a category with its products" })
  @ApiSuccessRes({
    model: CategoryWithProductDto,
    description: "A single category with its products",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    404: {
      description: "Category not found",
      example: { error: { details: "Category not found" } },
    },
  })
  @AllowAnonymous()
  async getOne(
    @Param() param: UuidParamDto,
  ): Promise<SuccessRes<CategoryWithProducts>> {
    const categoryWithProducts = await this.categoriesService.getOneById(
      param.id,
    );

    return successResponse(categoryWithProducts);
  }

  @Post()
  @ApiOperation({ description: "Create a new category" })
  @ApiBearerAuth()
  @ApiCreatedRes({
    model: CategoryDto,
    description: "Category created",
  })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: { error: { details: "name: Required" } },
    },
    401: {
      description: "Not authenticated: no or invalid session",
    },
    403: {
      description: "Insufficient permissions to create categories",
    },
    409: {
      description: "Category name already exists",
      example: { error: { details: "Category name already exists" } },
    },
  })
  @UserHasPermission({ permission: { category: ["create"] } })
  async create(@Body() body: CreateCategoryDto): Promise<SuccessRes<Category>> {
    const newCategory = await this.categoriesService.create(body.name);
    return successResponse(newCategory);
  }

  @Put(":id")
  @ApiOperation({ description: "Update a category" })
  @ApiBearerAuth()
  @ApiSuccessRes({
    model: CategoryDto,
    description: "Category updated",
  })
  @ApiErrors({
    400: {
      description: "Invalid input",
      example: { error: { details: "id: Invalid uuid; name: Required" } },
    },
    401: {
      description: "Not authenticated: no or invalid session",
    },
    403: {
      description: "Insufficient permissions to update categories",
    },
    404: {
      description: "Category not found",
      example: { error: { details: "Category not found" } },
    },
    409: {
      description: "Category name is already in use",
      example: { error: { details: "Category name is already in use" } },
    },
  })
  @UserHasPermission({ permission: { category: ["update"] } })
  async update(
    @Param() param: UuidParamDto,
    @Body() body: CreateCategoryDto,
  ): Promise<SuccessRes<Category>> {
    const updatedCategory = await this.categoriesService.update(
      param.id,
      body.name,
    );
    return successResponse(updatedCategory);
  }

  @Delete(":id")
  @ApiOperation({ description: "Delete a category" })
  @ApiBearerAuth()
  @ApiSuccessRes({
    model: CategoryDto,
    description: "Category deleted",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    401: {
      description: "Not authenticated: no or invalid session",
    },
    403: {
      description: "Insufficient permissions to delete categories",
    },
    404: {
      description: "Category not found",
      example: { error: { details: "Category not found" } },
    },
    409: {
      description: "Cannot delete: category has associated products",
      example: { error: { details: "Category has associated products" } },
    },
  })
  @UserHasPermission({ permission: { category: ["delete"] } })
  async delete(@Param() param: UuidParamDto): Promise<SuccessRes<Category>> {
    const deletedCategory = await this.categoriesService.delete(param.id);
    return successResponse(deletedCategory);
  }
}
