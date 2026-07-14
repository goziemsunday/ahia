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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  AllowAnonymous,
  Session,
  UserHasPermission,
  type UserSession,
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
  SearchQueryDto,
  UuidParamDto,
} from "../common/dto/shared.dto";
import type { SuccessRes } from "../lib/types";
import { buildPagination, successResponse } from "../lib/utils";
import { productImageValidators } from "./product.validators";
import {
  CreateProductDto,
  CreateProductUploadDto,
  ProductWithRelationsDto,
  ShopQueryDto,
  UpdateProductDto,
  UpdateProductUploadDto,
} from "./products.dto";
import { ProductsService } from "./products.service";
import type { ProductWithRelations } from "./products.types";

@Controller("products")
@ApiTags("Products")
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @ApiOperation({ description: "Get all products" })
  @ApiSuccessResPaginated({
    model: ProductWithRelationsDto,
    isArray: true,
    description: "All products with relations (categories, creator)",
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
  ): Promise<SuccessRes<ProductWithRelations[]>> {
    const { products, total } = await this.productsService.getAll(
      query.page,
      query.limit,
    );
    const pagination = buildPagination(query.page, query.limit, total);

    return successResponse(products, pagination);
  }

  @Get("featured")
  @ApiOperation({ description: "Get the featured product" })
  @ApiSuccessRes({
    model: ProductWithRelationsDto,
    description: "Featured product",
  })
  @ApiErrors({
    404: {
      description: "No products exist yet",
      example: { error: { details: "Product not found" } },
    },
  })
  @AllowAnonymous()
  async getFeatured(): Promise<SuccessRes<ProductWithRelations>> {
    const featuredProduct = await this.productsService.getFeatured();
    return successResponse(featuredProduct);
  }

  @Get("latest")
  @ApiOperation({ description: "Get the latest products" })
  @ApiSuccessRes({
    model: ProductWithRelationsDto,
    isArray: true,
    description: "Latest products",
  })
  @ApiErrors({
    400: {
      description: "Invalid limit parameter",
      example: { error: { details: "limit: Expected number, received NaN" } },
    },
    404: {
      description: "No latest products found",
      example: { error: { details: "Latest products not found" } },
    },
  })
  @AllowAnonymous()
  async getLatest(
    @Query() query: LimitQueryDto,
  ): Promise<SuccessRes<ProductWithRelations[]>> {
    const latestProducts = await this.productsService.getLatest(query.limit);
    return successResponse(latestProducts);
  }

  @Get("trending")
  @ApiOperation({ description: "Get trending products ranked by units sold in the last 30 days" })
  @ApiSuccessRes({
    model: ProductWithRelationsDto,
    isArray: true,
    description: "Trending products",
  })
  @ApiErrors({
    400: {
      description: "Invalid limit parameter",
      example: { error: { details: "limit: Expected number, received NaN" } },
    },
  })
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
  @ApiOperation({ description: "Get products with filtering, sorting, and pagination" })
  @ApiSuccessResPaginated({
    model: ProductWithRelationsDto,
    isArray: true,
    description: "Shop products with filtering, sorting, and pagination",
  })
  @ApiErrors({
    400: {
      description: "Invalid shop query parameters",
      example: {
        error: {
          details:
            "page: Expected number, received NaN; maxPrice: Expected number, received string",
        },
      },
    },
  })
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
  @ApiOperation({ description: "Search products by name" })
  @ApiSuccessRes({
    model: ProductWithRelationsDto,
    isArray: true,
    description: "Search products by query string",
  })
  @ApiErrors({
    400: {
      description: "Invalid search query",
      example: { error: { details: "q: Required" } },
    },
  })
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
  @ApiOperation({ description: "Get a product" })
  @ApiSuccessRes({
    model: ProductWithRelationsDto,
    description: "A single product by ID with its relations",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    404: {
      description: "Product not found",
      example: { error: { details: "Product not found" } },
    },
  })
  @AllowAnonymous()
  async getOne(
    @Param() param: UuidParamDto,
  ): Promise<SuccessRes<ProductWithRelations>> {
    const product = await this.productsService.getOne(param.id);
    return successResponse(product);
  }

  @Post()
  @ApiOperation({ description: "Create a new product" })
  @ApiBearerAuth()
  @ApiCreatedRes({
    model: ProductWithRelationsDto,
    description: "Product created",
  })
  @ApiErrors({
    400: {
      description:
        "Invalid input: validation, missing image, or invalid fields",
      example: {
        error: {
          details:
            "name: Required; price: Price must be a positive number; At least 1 image is required",
        },
      },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: { description: "Insufficient permissions to create products" },
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: CreateProductUploadDto })
  @UseInterceptors(FilesInterceptor("images", 3))
  @UserHasPermission({ permission: { product: ["create"] } })
  async create(
    @Body() body: CreateProductDto,
    @UploadedFiles(new ParseFilePipe({ validators: productImageValidators }))
    images: Express.Multer.File[],
    @Session() session: UserSession,
  ): Promise<SuccessRes<ProductWithRelations>> {
    const newProduct = await this.productsService.create(
      body,
      images,
      session.user.id,
    );
    return successResponse(newProduct);
  }

  @Put(":id")
  @ApiOperation({ description: "Update an existing product" })
  @ApiBearerAuth()
  @ApiSuccessRes({
    model: ProductWithRelationsDto,
    description: "Product updated",
  })
  @ApiErrors({
    400: {
      description: "Invalid input: validation, image issues, or invalid fields",
      example: {
        error: {
          details:
            "id: Invalid uuid; sizes: names must be unique (case-insensitive); At least 1 image is required",
        },
      },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: { description: "Insufficient permissions to update products" },
    404: {
      description: "Product not found",
      example: { error: { details: "Product not found" } },
    },
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UpdateProductUploadDto })
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
  ): Promise<SuccessRes<ProductWithRelations>> {
    const updatedProduct = await this.productsService.update(
      param.id,
      body,
      images,
    );
    return successResponse(updatedProduct);
  }

  @Delete(":id")
  @ApiOperation({ description: "Delete a product" })
  @ApiBearerAuth()
  @ApiSuccessRes({
    model: ProductWithRelationsDto,
    description: "Product deleted",
  })
  @ApiErrors({
    400: {
      description: "Invalid UUID parameter",
      example: { error: { details: "id: Invalid uuid" } },
    },
    401: { description: "Not authenticated: no or invalid session" },
    403: { description: "Insufficient permissions to delete products" },
    404: {
      description: "Product not found",
      example: { error: { details: "Product not found" } },
    },
    409: {
      description: "Product has dependencies: exists in carts or orders",
      example: {
        error: {
          details:
            "Product cannot be deleted as it exists in user carts and orders",
        },
      },
    },
  })
  @UserHasPermission({ permission: { product: ["delete"] } })
  async delete(
    @Param() param: UuidParamDto,
  ): Promise<SuccessRes<ProductWithRelations>> {
    const deletedProduct = await this.productsService.delete(param.id);
    return successResponse(deletedProduct);
  }
}
