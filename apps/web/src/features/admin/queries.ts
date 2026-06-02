import { z } from "zod";

import {
  ListUsersQuerySchema,
  WindowNumberSchema,
} from "@repo/db/validators/admin.validator";
import { OrderWithCustomerSelectSchema } from "@repo/db/validators/order.validator";
import {
  CategoryWithCountSchema,
  ProductExtendedSchema,
} from "@repo/db/validators/product.validator";
import { UserSelectSchema } from "@repo/db/validators/user.validator";

import { $fetch } from "@/lib/fetch";
import { successResSchema } from "@/lib/schemas";

// ── Users ──────────────────────────────────────────────────

const AdminStatsSchema = z.object({
  revenue: z.object({
    value: WindowNumberSchema,
    changePct: WindowNumberSchema,
  }),
  orders: z.object({
    value: WindowNumberSchema,
    changePct: WindowNumberSchema,
  }),
  products: z.object({
    value: z.object({
      total: z.number(),
    }),
    changePct: WindowNumberSchema,
  }),
  users: z.object({
    value: z.object({
      total: z.number(),
    }),
    change: WindowNumberSchema,
  }),
});

const AdminUsersListSchema = z.object({
  users: z.array(UserSelectSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type AdminUsersListParams = z.infer<typeof ListUsersQuerySchema>;
export type AdminUsersListResponse = z.infer<typeof AdminUsersListSchema>;
export type AdminUserRow = AdminUsersListResponse["users"][number];

export const defaultAdminUsersListParams: AdminUsersListParams = {
  limit: 100,
  offset: 0,
  sortBy: "name",
  sortDirection: "asc",
};

export const getAdminStats = async (cookie?: string) => {
  const { data, error } = await $fetch("/admin/stats", {
    headers: cookie ? { cookie } : undefined,
    output: successResSchema(AdminStatsSchema),
  });

  if (error) {
    console.error(error);
    return null;
  }

  return data?.data ?? null;
};

// ── Monthly Stats (charts) ──────────────────────────────────

const MonthlyStatsEntrySchema = z.object({
  month: z.string(),
  revenue: z.number(),
  orders: z.number(),
  products: z.number(),
  users: z.number(),
});

const MonthlyStatsSchema = z.array(MonthlyStatsEntrySchema);

export type MonthlyStatsEntry = z.infer<typeof MonthlyStatsEntrySchema>;

export const getAdminMonthlyStats = async (cookie?: string) => {
  const { data, error } = await $fetch("/admin/stats/monthly", {
    headers: cookie ? { cookie } : undefined,
    output: successResSchema(MonthlyStatsSchema),
  });

  if (error) {
    console.error(error);
    return null;
  }

  return data?.data ?? null;
};

export const getAdminUsers = async (
  queryParams: AdminUsersListParams = {},
  cookie?: string,
) => {
  const validatedQueryParams = ListUsersQuerySchema.parse(queryParams);

  const { data, error } = await $fetch("/admin/users", {
    query: validatedQueryParams,
    headers: cookie ? { cookie } : undefined,
    output: successResSchema(AdminUsersListSchema),
  });

  if (error) {
    console.error(error);
    return null;
  }

  return data?.data ?? null;
};

// ── Categories ──────────────────────────────────────────────────

const AdminCategoriesListSchema = z.array(CategoryWithCountSchema);

export type AdminCategoryRow = z.infer<typeof CategoryWithCountSchema>;

export type AdminCategoriesListParams = {
  page?: number;
  limit?: number;
};

export const defaultAdminCategoriesListParams: AdminCategoriesListParams = {
  page: 1,
  limit: 50,
};

export const getAdminCategories = async (
  queryParams: AdminCategoriesListParams = {},
  cookie?: string,
) => {
  const { data, error } = await $fetch("/categories", {
    query: queryParams,
    headers: cookie ? { cookie } : undefined,
    output: successResSchema(AdminCategoriesListSchema),
  });

  if (error) {
    console.error(error);
    return null;
  }

  return {
    categories: data?.data ?? [],
    total: data?.pagination?.total ?? 0,
  };
};

// ── Products ──────────────────────────────────────────────────

const ProductsAdminListSchema = z.array(ProductExtendedSchema);

export type AdminProductRow = z.infer<typeof ProductExtendedSchema>;

export type AdminProductsListParams = {
  page?: number;
  limit?: number;
};

export const defaultAdminProductsListParams: AdminProductsListParams = {
  page: 1,
  limit: 50,
};

export const getAdminProducts = async (
  queryParams: AdminProductsListParams = {},
  cookie?: string,
) => {
  const { data, error } = await $fetch("/products", {
    query: queryParams,
    headers: cookie ? { cookie } : undefined,
    output: successResSchema(ProductsAdminListSchema),
  });

  if (error) {
    console.error(error);
    return null;
  }

  return {
    products: data?.data ?? [],
    total: data?.pagination?.total ?? 0,
  };
};

// ── Orders ──────────────────────────────────────────────────

const AdminOrdersListSchema = z.array(OrderWithCustomerSelectSchema);

export type AdminOrderRow = z.infer<typeof OrderWithCustomerSelectSchema>;

export type AdminOrdersListParams = {
  page?: number;
  limit?: number;
};

export const defaultAdminOrdersListParams: AdminOrdersListParams = {
  page: 1,
  limit: 50,
};

export const getAdminOrders = async (
  queryParams: AdminOrdersListParams = {},
  cookie?: string,
) => {
  const { data, error } = await $fetch("/admin/orders", {
    query: queryParams,
    headers: cookie ? { cookie } : undefined,
    output: successResSchema(AdminOrdersListSchema),
  });

  if (error) {
    console.error(error);
    return null;
  }

  return {
    orders: data?.data ?? [],
    total: data?.pagination?.total ?? 0,
  };
};
