import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import { db, eq } from "@repo/db";
import { cart, cartItem } from "@repo/db/schemas/cart.schema";

import { ProductsService } from "../product/products.service";
import { AddToCartDto, UpdateCartItemDto } from "./cart.dto";
import { CartItemRow, CartItemWithDetails, CartResponse } from "./cart.types";
import { buildCartResponse } from "./cart.utils";

@Injectable()
export class CartService {
  constructor(private productsService: ProductsService) {}

  // get cart for user
  async getCart(userId: string): Promise<CartResponse> {
    let userCart = await db.query.cart.findFirst({
      where: (c, { eq }) => eq(c.userId, userId),
      with: {
        cartItems: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!userCart) {
      const [newCart] = await db
        .insert(cart)
        .values({
          userId,
        })
        .returning();
      userCart = { ...newCart, cartItems: [] };
    }

    return buildCartResponse(userCart);
  }

  // get a single cart item
  async getCartItem(
    cartId: string,
    productId: string,
  ): Promise<CartItemRow | undefined> {
    const cartItem = await db.query.cartItem.findFirst({
      where: (cartItem, { eq, and }) =>
        and(eq(cartItem.cartId, cartId), eq(cartItem.productId, productId)),
    });

    return cartItem;
  }

  // get a single cart item with details
  async getCartItemWithDetails(
    itemId: string,
  ): Promise<CartItemWithDetails | undefined> {
    const cartItemWithDetails = await db.query.cartItem.findFirst({
      where: (cartItem, { eq, and }) => and(eq(cartItem.id, itemId)),
      with: {
        cart: true,
        product: true,
      },
    });

    return cartItemWithDetails;
  }

  // update the quantity of an existing cart item
  async updateItemQuantity(
    cartItemId: string,
    quantity: number,
  ): Promise<CartItemRow> {
    const [updatedCartItem] = await db
      .update(cartItem)
      .set({ quantity })
      .where(eq(cartItem.id, cartItemId))
      .returning();

    return updatedCartItem;
  }

  // add item to user's cart
  async addItem(userId: string, body: AddToCartDto): Promise<CartResponse> {
    // get product
    const product = await this.productsService.getOne(body.productId);

    // get user's cart
    const userCart = await this.getCart(userId);

    // check if the product is already in the cart
    const existingCartItem = await this.getCartItem(userCart.id, product.id);

    const totalRequestedQuantity =
      body.quantity + (existingCartItem?.quantity ?? 0);

    this.checkStockAvailability(
      totalRequestedQuantity,
      product.stockQuantity ?? 0,
      existingCartItem?.quantity ?? 0,
    );

    // add or update cart item in transaction
    await db.transaction(async () => {
      if (existingCartItem) {
        await this.updateItemQuantity(
          existingCartItem.id,
          totalRequestedQuantity,
        );
      } else {
        await db
          .insert(cartItem)
          .values({
            cartId: userCart.id,
            productId: product.id,
            quantity: body.quantity,
          })
          .returning();
      }
    });

    const updatedCart = await this.getCart(userId);

    return updatedCart;
  }

  // update cart item
  async updateItem(
    userId: string,
    itemId: string,
    body: UpdateCartItemDto,
  ): Promise<CartResponse> {
    // get cart
    const cartItem = await this.getCartItemWithDetails(itemId);

    if (!cartItem) {
      throw new NotFoundException("Cart item not found");
    }

    // ensure that the cart item belongs to the user
    if (cartItem.cart.userId !== userId) {
      throw new ForbiddenException(
        "You can only update items in your own cart",
      );
    }

    // check stock availability (only if quantity is increasing)
    if (body.quantity > cartItem.quantity) {
      this.checkStockAvailability(
        body.quantity,
        cartItem.product.stockQuantity || 0,
      );
    }

    // update cart item quantity
    await db.transaction(async () => {
      await this.updateItemQuantity(itemId, body.quantity);
    });

    // get updated cart with all relations
    const updatedCart = await this.getCart(userId);

    return updatedCart;
  }

  // delete cart item
  async deleteItem(userId: string, itemId: string): Promise<CartResponse> {
    // get cart
    const userCartItem = await this.getCartItemWithDetails(itemId);

    if (!userCartItem) {
      throw new NotFoundException("Cart item not found");
    }

    // ensure that the cart item belongs to the user
    if (userCartItem.cart.userId !== userId) {
      throw new ForbiddenException(
        "You can only remove items from your own cart",
      );
    }

    // update cart item quantity
    await db.transaction(async () => {
      await db.delete(cartItem).where(eq(cartItem.id, itemId)).returning();
    });

    // get updated cart with all relations
    const updatedCart = await this.getCart(userId);

    return updatedCart;
  }

  // clear cart
  async clearCart(userId: string): Promise<CartResponse> {
    const userCart = await this.getCart(userId);

    await db.transaction(async () => {
      await db
        .delete(cartItem)
        .where(eq(cartItem.cartId, userCart.id))
        .returning();
    });

    // get updated cart with all relations
    const updatedCart = await this.getCart(userId);

    return updatedCart;
  }

  // check whether `requestedQuantity` of a product can be fulfilled
  // given the current stock and what's already in the cart
  checkStockAvailability(
    requestedQuantity: number,
    stockQuantity: number,
    existingCartItemQuantity: number = 0,
  ) {
    if (requestedQuantity > stockQuantity) {
      if (stockQuantity === 0) {
        throw new UnprocessableEntityException(
          "Product is currently out of stock. Available: 0",
        );
      }
      const maxCanAdd = stockQuantity - existingCartItemQuantity;
      throw new UnprocessableEntityException(
        `Not enough stock available. Requested: ${requestedQuantity}, Available: ${stockQuantity}. Maximum you can add: ${maxCanAdd}`,
      );
    }
  }
}
