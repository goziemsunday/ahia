import { Injectable, NotFoundException } from "@nestjs/common";
import { AuthService } from "@thallesp/nestjs-better-auth";

import {
  and,
  count,
  countDistinct,
  db,
  desc,
  eq,
  gte,
  lt,
  sql,
} from "@repo/db";
import { session, User, user } from "@repo/db/schemas/auth.schema";
import { order } from "@repo/db/schemas/order.schema";
import { product } from "@repo/db/schemas/product.schema";

import type { auth } from "../lib/auth";
import { sendAccountCreatedEmail } from "../lib/email";
import { generatePassword, pctChange, round, toNumber } from "../lib/utils";
import { OrderWithItemsAndCustomer } from "../orders/orders.types";
import { CreateUserBodyDto } from "./admin.dto";
import { OverallStats, WindowKey } from "./admin.types";
import { getWindowBoundaries, WINDOWS } from "./admin.utils";

@Injectable()
export class AdminService {
  constructor(private authService: AuthService<typeof auth>) {}

  // get the total paid revenue between two dates
  async getPaidRevenueBetween(start: Date, end: Date): Promise<number> {
    const [result] = await db
      .select({
        amount: sql<string>`COALESCE(SUM(${order.totalAmount}), 0)`,
      })
      .from(order)
      .where(
        and(
          eq(order.paymentStatus, "paid"),
          gte(order.createdAt, start),
          lt(order.createdAt, end),
        ),
      );

    return round(toNumber(result?.amount));
  }

  // get the count of orders created between two dates
  async getOrdersCountBetween(start: Date, end: Date): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(order)
      .where(
        and(
          gte(order.createdAt, start),
          lt(order.createdAt, end),
          eq(order.paymentStatus, "paid"),
        ),
      );

    return toNumber(result?.total);
  }

  // gets the count of products created between two dates
  async getProductsCreatedBetween(start: Date, end: Date): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(product)
      .where(and(gte(product.createdAt, start), lt(product.createdAt, end)));

    return toNumber(result?.total);
  }

  // gets the count of active users between two dates
  async getActiveUsersBetween(start: Date, end: Date): Promise<number> {
    const [result] = await db
      .select({ total: countDistinct(session.userId) })
      .from(session)
      .where(and(gte(session.updatedAt, start), lt(session.updatedAt, end)));

    return toNumber(result?.total);
  }

  // gets the count of users registered between two dates
  async getUsersRegisteredBetween(start: Date, end: Date): Promise<number> {
    const [result] = await db
      .select({ total: count() })
      .from(user)
      .where(and(gte(user.createdAt, start), lt(user.createdAt, end)));

    return toNumber(result?.total);
  }

  // gets the total number of products in the system
  async getProductsTotal(): Promise<number> {
    const [result] = await db.select({ total: count() }).from(product);
    return toNumber(result?.total);
  }

  // gets the total number of users in the system
  async getUsersTotal(): Promise<number> {
    const [result] = await db.select({ total: count() }).from(user);
    return toNumber(result?.total);
  }

  // get overview stats for admin dashboard
  async getOverviewStats(): Promise<OverallStats> {
    const now = new Date();

    const revenueValue: Record<WindowKey, number> = {
      "24h": 0,
      "7d": 0,
      "1m": 0,
    };
    const revenueChangePct: Record<WindowKey, number> = {
      "24h": 0,
      "7d": 0,
      "1m": 0,
    };

    const ordersValue: Record<WindowKey, number> = {
      "24h": 0,
      "7d": 0,
      "1m": 0,
    };
    const ordersChangePct: Record<WindowKey, number> = {
      "24h": 0,
      "7d": 0,
      "1m": 0,
    };

    const productsChangePct: Record<WindowKey, number> = {
      "24h": 0,
      "7d": 0,
      "1m": 0,
    };

    const usersChange: Record<WindowKey, number> = {
      "24h": 0,
      "7d": 0,
      "1m": 0,
    };

    const windowResults = await Promise.all(
      WINDOWS.map(async (window) => {
        const { currentStart, previousStart } = getWindowBoundaries(
          now,
          window.ms,
        );

        const [
          currentRevenue,
          previousRevenue,
          currentOrders,
          previousOrders,
          currentProductsCreated,
          previousProductsCreated,
          currentActiveUsers,
        ] = await Promise.all([
          this.getPaidRevenueBetween(currentStart, now),
          this.getPaidRevenueBetween(previousStart, currentStart),
          this.getOrdersCountBetween(currentStart, now),
          this.getOrdersCountBetween(previousStart, currentStart),
          this.getProductsCreatedBetween(currentStart, now),
          this.getProductsCreatedBetween(previousStart, currentStart),
          this.getActiveUsersBetween(currentStart, now),
        ]);

        return {
          key: window.key,
          revenue: {
            value: currentRevenue,
            changePct: pctChange(currentRevenue, previousRevenue),
          },
          orders: {
            value: currentOrders,
            changePct: pctChange(currentOrders, previousOrders),
          },
          products: {
            changePct: pctChange(
              currentProductsCreated,
              previousProductsCreated,
            ),
          },
          users: {
            change: currentActiveUsers,
          },
        };
      }),
    );

    for (const result of windowResults) {
      revenueValue[result.key] = result.revenue.value;
      revenueChangePct[result.key] = result.revenue.changePct;
      ordersValue[result.key] = result.orders.value;
      ordersChangePct[result.key] = result.orders.changePct;
      productsChangePct[result.key] = result.products.changePct;
      usersChange[result.key] = result.users.change;
    }

    const [productsTotal, usersTotal] = await Promise.all([
      this.getProductsTotal(),
      this.getUsersTotal(),
    ]);

    return {
      revenue: {
        value: revenueValue,
        changePct: revenueChangePct,
      },
      orders: {
        value: ordersValue,
        changePct: ordersChangePct,
      },
      products: {
        value: {
          total: productsTotal,
        },
        changePct: productsChangePct,
      },
      users: {
        value: {
          total: usersTotal,
        },
        change: usersChange,
      },
    };
  }

  // returns monthly aggregated stats for the last 12 months
  async getMonthlyStats() {
    const now = new Date();
    const months: { start: Date; end: Date; label: string }[] = [];

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      months.push({ start, end, label });
    }

    const results = await Promise.all(
      months.map(async ({ start, end, label }) => {
        const [revenue, orders, products, users] = await Promise.all([
          this.getPaidRevenueBetween(start, end),
          this.getOrdersCountBetween(start, end),
          this.getProductsCreatedBetween(start, end),
          this.getUsersRegisteredBetween(start, end),
        ]);

        return { month: label, revenue, orders, products, users };
      }),
    );

    return results;
  }

  // get user by ID
  async getUserById(userId: string): Promise<User> {
    const user = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.id, userId),
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  // get all orders with customer info
  async getAllOrders(
    page: number = 1,
    limit?: number,
  ): Promise<{ orders: OrderWithItemsAndCustomer[]; total: number }> {
    const queryOpts = {
      ...(limit ? { limit, offset: (page - 1) * limit } : {}),
      with: {
        orderItems: {
          with: {
            product: true,
          },
        },
        customer: true,
      },
    } as const;

    const allOrders = await db.query.order.findMany({
      ...queryOpts,
      orderBy: [desc(order.createdAt)],
    });

    const totalResult = await db.select({ count: count() }).from(order);
    const total = totalResult[0].count;

    return { orders: allOrders, total };
  }

  // get single order with customer info by ID
  async getOrderById(orderId: string): Promise<OrderWithItemsAndCustomer> {
    const order = await db.query.order.findFirst({
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

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  // create new user
  async createNewUser(body: CreateUserBodyDto): Promise<User> {
    const existingUser = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.email, body.email),
    });

    if (existingUser) return existingUser;

    // if the user does not exist, create a new one
    const password = generatePassword();
    const { user: newUser } = await this.authService.api.createUser({
      body: {
        email: body.email,
        name: body.name,
        role: body.role as
          | "admin"
          | "superadmin"
          | "userRole"
          | ("admin" | "superadmin" | "userRole")[]
          | undefined,
        password,
      },
    });

    // send account created & verification emails
    await sendAccountCreatedEmail({
      to: body.email,
      role: body.role,
      name: body.name,
      email: body.email,
      password,
    });
    await this.authService.api.sendVerificationEmail({
      body: {
        email: body.email,
      },
    });

    return newUser as User;
  }
}
