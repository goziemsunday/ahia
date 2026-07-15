import { count, db, desc, eq, sql } from "@repo/db";
import { order, orderItem } from "@repo/db/schemas/order.schema";
import { product } from "@repo/db/schemas/product.schema";

/**
 * Get all orders with customer information (admin only)
 */
export const getAllOrders = async (page: number = 1, limit?: number) => {
  let allOrders;
  if (limit) {
    allOrders = await db.query.order.findMany({
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
        customer: true,
      },
      orderBy: [desc(order.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });
  } else {
    allOrders = await db.query.order.findMany({
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
        customer: true,
      },
      orderBy: [desc(order.createdAt)],
    });
  }

  if (!allOrders) return { orders: [], total: 0 };

  const totalResult = await db.select({ count: count() }).from(order);
  const total = totalResult[0].count;

  return { orders: allOrders, total };
};

/**
 * Get order by ID with customer information (admin only)
 */
export const getAdminOrderById = async (orderId: string) => {
  const orderWithItems = await db.query.order.findFirst({
    where: (o, { eq }) => eq(o.id, orderId),
    with: {
      orderItems: {
        with: {
          product: true,
        },
      },
      customer: true,
    },
  });

  return orderWithItems;
};

/**
 * Get user's orders with order items and products
 */
export const getUserOrders = async (
  userId: string,
  page: number = 1,
  limit?: number,
) => {
  let userOrders;
  if (limit) {
    userOrders = await db.query.order.findMany({
      where: (o, { eq }) => eq(o.userId, userId),
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(order.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });
  } else {
    userOrders = await db.query.order.findMany({
      where: (o, { eq }) => eq(o.userId, userId),
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
      },
      orderBy: [desc(order.createdAt)],
    });
  }

  if (!userOrders) return { orders: [], total: 0 };

  const totalResult = await db
    .select({ count: count() })
    .from(order)
    .where(eq(order.userId, userId));
  const total = totalResult[0].count;

  return { orders: userOrders, total };
};

/**
 * Generate a random order number
 */
export const generateOrderNumber = (): string => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString().slice(2, 8).padStart(6, "0");
  return `ORD-${year}-${randomSuffix}`;
};

/**
 * Create a new order
 */
export const createOrder = async (
  userId: string,
  email: string,
  totalAmount: string,

  stripeSessionId?: string | null,
) => {
  const orderNumber = generateOrderNumber();

  const [newOrder] = await db
    .insert(order)
    .values({
      orderNumber,
      userId,
      email,
      totalAmount,
      stripeCheckoutSessionId: stripeSessionId,
      status: "pending",
      paymentStatus: "pending",
    })
    .returning();

  return newOrder;
};

/**
 * Create order items from cart items
 */
export const createOrderItems = async (
  orderId: string,
  cartItems: Array<{
    productId: string;
    quantity: number;
    unitPrice: string;
  }>,
) => {
  const orderItemsData = cartItems.map((item) => {
    const subTotal = (parseFloat(item.unitPrice) * item.quantity).toFixed(2);
    return {
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subTotal,
    };
  });

  const newOrderItems = await db
    .insert(orderItem)
    .values(orderItemsData)
    .returning();

  return newOrderItems;
};

/**
 * Get order by ID with all relations (no customer)
 */
export const getOrderById = async (orderId: string) => {
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
};

/**
 * Get order by Stripe Checkout Session ID
 */
export const getOrderByStripeSessionId = async (sessionId: string) => {
  const orderWithItems = await db.query.order.findFirst({
    where: (o, { eq }) => eq(o.stripeCheckoutSessionId, sessionId),
    with: {
      orderItems: {
        with: {
          product: true,
        },
      },
      customer: true,
    },
  });

  return orderWithItems;
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
  orderId: string,
  status: string,
  paymentStatus?: string,
  paymentMethod?: string,
) => {
  const updateData: Record<string, string> = { status };

  if (paymentStatus) {
    updateData.paymentStatus = paymentStatus;
  }

  if (paymentMethod) {
    updateData.paymentMethod = paymentMethod;
  }

  const [updatedOrder] = await db
    .update(order)
    .set(updateData)
    .where(eq(order.id, orderId))
    .returning();

  return updatedOrder;
};

/**
 * Get user's cart by user ID
 */
export const getUserCartId = async (userId: string) => {
  const userCart = await db.query.cart.findFirst({
    where: (c, { eq }) => eq(c.userId, userId),
  });

  return userCart;
};

/**
 * Reserve stock for order items
 */
export const reserveStock = async (
  cartItems: Array<{
    productId: string;
    quantity: number;
  }>,
) => {
  await Promise.all(
    cartItems.map((item) =>
      db
        .update(product)
        .set({
          stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
        })
        .where(eq(product.id, item.productId)),
    ),
  );
};

/**
 * Restore stock (when payment fails)
 */
export const restoreStock = async (
  orderItems: Array<{
    productId: string;
    quantity: number;
  }>,
) => {
  await Promise.all(
    orderItems.map((item) =>
      db
        .update(product)
        .set({
          stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
        })
        .where(eq(product.id, item.productId)),
    ),
  );
};
