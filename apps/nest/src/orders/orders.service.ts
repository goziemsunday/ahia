import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
// import { User } from "better-auth";
import { UserSession } from "@thallesp/nestjs-better-auth";

import { count, db, desc, eq, sql } from "@repo/db";
import { cartItem } from "@repo/db/schemas/cart.schema";
import { order, orderItem } from "@repo/db/schemas/order.schema";
import { product } from "@repo/db/schemas/product.schema";

import { CartService } from "../cart/cart.service";
import { sendOrderReceiptEmail } from "../lib/email";
import env from "../lib/env";
import { stripe } from "../lib/stripe";
import { ProductsService } from "../product/products.service";
import { CheckoutResponse, OrderWithItems } from "./orders.types";
import { generateOrderNumber } from "./orders.utils";

@Injectable()
export class OrdersService {
  constructor(
    private productsService: ProductsService,
    private cartService: CartService,
  ) {}

  // get user's order history
  async getAllForUser(
    userId: string,
    page: number = 1,
    limit?: number,
  ): Promise<{ orders: OrderWithItems[]; total: number }> {
    const queryOpts = {
      ...(limit ? { limit, offset: (page - 1) * limit } : {}),
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
      },
    } as const;

    const userOrders = await db.query.order.findMany({
      where: (o, { eq }) => eq(o.userId, userId),
      ...queryOpts,
      orderBy: [desc(order.createdAt)],
    });

    const totalResult = await db
      .select({ count: count() })
      .from(order)
      .where(eq(order.userId, userId));
    const total = totalResult[0].count;

    return { orders: userOrders, total };
  }

  // get a single order for a user
  async getOneForUser(
    orderId: string,
    userId: string,
  ): Promise<OrderWithItems> {
    const orderWithItems = await db.query.order.findFirst({
      where: (o, { eq }) => eq(o.id, orderId),
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!orderWithItems || orderWithItems.userId !== userId) {
      throw new NotFoundException("Order not found");
    }

    return orderWithItems;
  }

  // get a single order by ID with all relations (no customer)
  async getOneById(orderId: string): Promise<OrderWithItems | undefined> {
    const orderWithItems = await db.query.order.findFirst({
      where: (o, { eq }) => eq(o.id, orderId),
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
      },
    });

    return orderWithItems;
  }

  // get a single order by Stripe checkout session ID
  async getOneByStripeSessionId(
    sessionId: string,
  ): Promise<OrderWithItems | undefined> {
    const orderWithItems = await db.query.order.findFirst({
      where: (o, { eq }) => eq(o.stripeCheckoutSessionId, sessionId),
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
      },
    });

    return orderWithItems;
  }

  // create checkout for user
  async createCheckout(
    userId: string,
    userEmail: string,
  ): Promise<CheckoutResponse> {
    const userCart = await this.cartService.getCart(userId);

    // ensure cart isnt empty
    if (userCart.cartItems.length === 0) {
      throw new BadRequestException(
        "Cart is empty. Add items to cart before creating order.",
      );
    }

    let totalAmount = 0;

    // validate each cart item: ensure that the items exists & there's sufficient stock
    for (const cartItem of userCart.cartItems) {
      if (!cartItem.product) {
        throw new UnprocessableEntityException(
          `Product with ID "${cartItem.productId}" no longer exists`,
        );
      }

      const availableStock = cartItem.product.stockQuantity || 0;
      if (cartItem.quantity > availableStock) {
        throw new UnprocessableEntityException(
          `Not enough stock for "${cartItem.product.name}". Requested: ${cartItem.quantity}, Available: ${availableStock}`,
        );
      }

      // calculate total
      totalAmount +=
        parseFloat((cartItem.product as { price: string }).price) *
        cartItem.quantity;
    }

    // create order + reserve stock + stripe session
    const result = await db.transaction(async () => {
      const orderNumber = generateOrderNumber();

      // create order
      const [newOrder] = await db
        .insert(order)
        .values({
          orderNumber,
          userId,
          email: userEmail,
          totalAmount: totalAmount.toFixed(2),
          stripeCheckoutSessionId: null,
          status: "pending",
          paymentStatus: "pending",
        })
        .returning();

      // create order items with frozen prices
      const orderItemsData = userCart.cartItems.map((item) => {
        const subTotal = (
          parseFloat(item.product.price) * item.quantity
        ).toFixed(2);
        return {
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.product.price,
          subTotal,
        };
      });
      await db.insert(orderItem).values(orderItemsData).returning();

      // reserve stock immediately
      await Promise.all(
        userCart.cartItems.map((item) =>
          db
            .update(product)
            .set({
              stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
            })
            .where(eq(product.id, item.productId)),
        ),
      );

      // create Stripe Checkout Session
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: userCart.cartItems.map((cartItem) => {
          const product = cartItem.product as {
            name: string;
            description: string | null;
            price: string;
            images: { url: string }[];
          };
          return {
            price_data: {
              currency: "usd",
              product_data: {
                name: product.name,
                description: product.description || undefined,
                images: product.images
                  .map((img) => img.url)
                  .filter((url): url is string => Boolean(url)),
              },
              unit_amount: Math.round(parseFloat(product.price) * 100),
            },
            quantity: cartItem.quantity,
          };
        }),
        mode: "payment",
        success_url: `${env.WEB_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.WEB_URL}/checkout/cancel`,
        customer_email: userEmail,
        client_reference_id: newOrder.id,
        metadata: {
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          userId,
        },
        shipping_address_collection: {
          allowed_countries: ["US", "CA", "GB", "AU", "NG", "GH"],
        },
        billing_address_collection: "required",
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      });

      // update order with Stripe session ID
      await db
        .update(order)
        .set({ stripeCheckoutSessionId: checkoutSession.id })
        .where(eq(order.id, newOrder.id));

      return { order: newOrder, checkoutSession };
    });

    const orderWithItems = await this.getOneById(result.order.id);

    if (!orderWithItems) {
      throw new InternalServerErrorException(
        "Failed to retrieve created order",
      );
    }

    return {
      order: orderWithItems,
      checkoutUrl: result.checkoutSession.url!,
      checkoutSessionId: result.checkoutSession.id,
      stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY,
    };
  }

  // verify checkout session and update order status
  async verifySession(
    user: UserSession["user"],
    sessionId: string,
  ): Promise<OrderWithItems> {
    // retrieve the session from Stripe to get the real payment status
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw new NotFoundException("Checkout session not found");
    }

    // find the order by stripe session ID
    const existingOrder = await this.getOneByStripeSessionId(sessionId);

    if (!existingOrder || existingOrder.userId !== user.id) {
      throw new NotFoundException("Order not found for this session");
    }

    // only update if order is still pending
    if (
      existingOrder.status === "pending" &&
      session.payment_status === "paid"
    ) {
      const updateOrderData: Record<string, string> = {
        status: "completed",
        paymentStatus: "paid",
        paymentMethod: session.payment_method_types?.[0] || "card",
      };

      await db
        .update(order)
        .set(updateOrderData)
        .where(eq(order.id, existingOrder.id))
        .returning();

      const userCart = await this.cartService.getCart(user.id);

      // clear all items from the cart
      await db
        .delete(cartItem)
        .where(eq(cartItem.cartId, userCart.id))
        .returning();

      // send receipt email
      const orderWithReceipt = await this.getOneById(existingOrder.id);
      if (orderWithReceipt) {
        sendOrderReceiptEmail(orderWithReceipt, user.name).catch((err) => {
          console.error("[Verify Session] Failed to send receipt email:", err);
        });
      }

      console.log(
        `[Verify Session] Order ${existingOrder.orderNumber} marked as paid`,
      );
    }

    // return the updated order
    const updatedOrder = await this.getOneById(existingOrder.id);

    if (!updatedOrder) {
      throw new InternalServerErrorException(
        "Failed to retrieve updated order",
      );
    }

    return updatedOrder;
  }
}
