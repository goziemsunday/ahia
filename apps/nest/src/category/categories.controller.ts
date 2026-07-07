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
import {
  AllowAnonymous,
  UserHasPermission,
} from "@thallesp/nestjs-better-auth";

import {
  LimitQueryDto,
  PaginationQueryDto,
  UuidParamDto,
} from "../common/dto/shared.dto";
import type { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import { CreateCategoryDto } from "./categories.dto";
import { CategoriesService } from "./categories.service";
import {
  Category,
  CategoryWithCount,
  CategoryWithProducts,
} from "./categories.types";

@Controller("categories")
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Get()
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
  @AllowAnonymous()
  async getTop(
    @Query() query: LimitQueryDto,
  ): Promise<SuccessRes<CategoryWithCount[]>> {
    const top = await this.categoriesService.getTop(query.limit);
    return successResponse(top);
  }

  @Get(":id")
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
  @UserHasPermission({
    permission: { category: ["create", "update", "delete"] },
  })
  async create(@Body() body: CreateCategoryDto): Promise<SuccessRes<Category>> {
    const newCategory = await this.categoriesService.create(body.name);
    return successResponse(newCategory);
  }

  @Put(":id")
  @UserHasPermission({
    permission: { category: ["create", "update", "delete"] },
  })
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
  @UserHasPermission({
    permission: { category: ["create", "update", "delete"] },
  })
  async delete(@Param() param: UuidParamDto): Promise<SuccessRes<Category>> {
    const deletedCategory = await this.categoriesService.delete(param.id);
    return successResponse(deletedCategory);
  }
}
