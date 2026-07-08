import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  AllowAnonymous,
  Session,
  UserHasPermission,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

import {
  LimitQueryDto,
  PaginationQueryDto,
  SearchQueryDto,
  UuidParamDto,
} from "../common/dto/shared.dto";
import { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import { productImageValidators } from "./product.validators";
import {
  CreateProductDto,
  ShopQueryDto,
  UpdateProductDto,
} from "./products.dto";
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

  @Post()
  @UseInterceptors(FilesInterceptor("images", 3))
  @UserHasPermission({ permission: { product: ["create"] } })
  async create(
    @Body() body: CreateProductDto,
    @UploadedFiles(new ParseFilePipe({ validators: productImageValidators }))
    images: Express.Multer.File[],
    @Session() session: UserSession,
  ) {
    const newProduct = await this.productsService.create(
      body,
      images,
      session.user.id,
    );
    return successResponse(newProduct);
  }

  @Put(":id")
  @UseInterceptors(FilesInterceptor("images", 3))
  @UserHasPermission({ permission: { product: ["update"] } })
  async update(
    @Param() param: UuidParamDto,
    @Body() body: UpdateProductDto,
    @UploadedFiles(
      new ParseFilePipe({
        validators: productImageValidators,
        fileIsRequired: false,
      }),
    )
    images: Express.Multer.File[],
  ) {
    const updatedProduct = await this.productsService.update(
      param.id,
      body,
      images,
    );
    return successResponse(updatedProduct);
  }

  @Delete(":id")
  @UserHasPermission({ permission: { product: ["delete"] } })
  async delete(@Param() param: UuidParamDto) {
    const deletedProducts = await this.productsService.delete(param.id);
    return successResponse(deletedProducts);
  }
}
