import { Controller, Get, Param, Query } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import {
  LimitQueryDto,
  PaginationQueryDto,
  SearchQueryDto,
  UuidParamDto,
} from "../common/dto/shared.dto";
import { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import { ShopQueryDto } from "./products.dto";
import { ProductsService } from "./products.service";
import { ProductWithRelations } from "./products.types";

@Controller("products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @AllowAnonymous()
  async getAll(
    @Query() query: PaginationQueryDto,
  ): Promise<SuccessRes<ProductWithRelations[]>> {
    const { products, total } = await this.productsService.getAll(
      query.page,
      query.limit,
    );
    const pagination = buildPagination(query.page, query.limit, total);

    return successResponse(products, pagination);
  }

  @Get("featured")
  @AllowAnonymous()
  async getFeatured(): Promise<SuccessRes<ProductWithRelations>> {
    const featuredProduct = await this.productsService.getFeatured();
    return successResponse(featuredProduct);
  }

  @Get("latest")
  @AllowAnonymous()
  async getLatest(
    @Query() query: LimitQueryDto,
  ): Promise<SuccessRes<ProductWithRelations[]>> {
    const latestProducts = await this.productsService.getLatest(query.limit);
    return successResponse(latestProducts);
  }

  @Get("trending")
  @AllowAnonymous()
  async getTrending(
    @Query() query: LimitQueryDto,
  ): Promise<SuccessRes<ProductWithRelations[]>> {
    const trendingProducts = await this.productsService.getTrending(
      query.limit,
    );
    return successResponse(trendingProducts);
  }

  @Get("shop")
  @AllowAnonymous()
  async getShop(
    @Query() query: ShopQueryDto,
  ): Promise<SuccessRes<ProductWithRelations[]>> {
    const { products: shopProducts, total } =
      await this.productsService.getShop(query);
    const pagination = buildPagination(query.page, query.limit, total);

    return successResponse(shopProducts, pagination);
  }

  @Get("search")
  @AllowAnonymous()
  async search(
    @Query() query: SearchQueryDto,
  ): Promise<SuccessRes<ProductWithRelations[]>> {
    const searchedProducts = await this.productsService.search(
      query.q,
      query.limit,
    );
    return successResponse(searchedProducts);
  }

  @Get(":id")
  @AllowAnonymous()
  async getOne(
    @Param() param: UuidParamDto,
  ): Promise<SuccessRes<ProductWithRelations>> {
    const product = await this.productsService.getOne(param.id);
    return successResponse(product);
  }
}
