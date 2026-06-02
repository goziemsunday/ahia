"use server";

import {
  CategorySelectSchema,
  ProductExtendedSchema,
} from "@repo/db/validators/product.validator";
import { UserSelectSchema } from "@repo/db/validators/user.validator";

import { getAuthHeaders } from "@/lib/auth";
import { $fetchAndThrow } from "@/lib/fetch";
import { successResSchema } from "@/lib/schemas";

// ── Users ──────────────────────────────────────────────────

export const createAdminUser = async (body: {
  name: string;
  email: string;
  role: "user" | "admin";
}) => {
  const { data } = await $fetchAndThrow("/admin/users", {
    method: "POST",
    headers: await getAuthHeaders(),
    body,
    output: successResSchema(UserSelectSchema),
  });

  return data ?? null;
};

// ── Categories ──────────────────────────────────────────────────

export const createCategory = async (body: { name: string }) => {
  const { data } = await $fetchAndThrow("/categories", {
    method: "POST",
    headers: await getAuthHeaders(),
    body,
    output: successResSchema(CategorySelectSchema),
  });

  return data ?? null;
};

export const updateCategory = async ({
  id,
  body,
}: {
  id: string;
  body: { name: string };
}) => {
  const { data } = await $fetchAndThrow(`/categories/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body,
    output: successResSchema(CategorySelectSchema),
  });

  return data ?? null;
};

export const deleteCategory = async (id: string) => {
  const { data } = await $fetchAndThrow(`/categories/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    output: successResSchema(CategorySelectSchema),
  });

  return data ?? null;
};

// ── Products ──────────────────────────────────────────────────

export interface CreateAdminProductInput {
  name: string;
  description?: string;
  price: string;
  stockQuantity: string;
  categoryIds: string[];
  sizes?: { name: string; inStock: boolean }[];
  colors?: { name: string; inStock: boolean }[];
  images: File[];
}

export const createAdminProduct = async (input: CreateAdminProductInput) => {
  const formData = new FormData();
  formData.append("name", input.name);
  if (input.description) formData.append("description", input.description);
  formData.append("price", input.price);
  formData.append("stockQuantity", input.stockQuantity);
  formData.append("categoryIds", JSON.stringify(input.categoryIds));
  if (input.sizes && input.sizes.length > 0) {
    formData.append("sizes", JSON.stringify(input.sizes));
  }
  if (input.colors && input.colors.length > 0) {
    formData.append("colors", JSON.stringify(input.colors));
  }
  for (const image of input.images) {
    formData.append("images", image);
  }

  const { data } = await $fetchAndThrow("/products", {
    method: "POST",
    headers: await getAuthHeaders(),
    body: formData,
    output: successResSchema(ProductExtendedSchema),
  });

  return data ?? null;
};

export interface UpdateAdminProductInput {
  name?: string;
  description?: string;
  price?: string;
  stockQuantity?: string;
  categoryIds?: string[];
  sizes?: { name: string; inStock: boolean }[];
  colors?: { name: string; inStock: boolean }[];
  keepImageKeys?: string[];
  newImages?: File[];
}

export const updateAdminProduct = async ({
  id,
  input,
}: {
  id: string;
  input: UpdateAdminProductInput;
}) => {
  const formData = new FormData();
  if (input.name !== undefined) formData.append("name", input.name);
  if (input.description !== undefined)
    formData.append("description", input.description);
  if (input.price !== undefined) formData.append("price", input.price);
  if (input.stockQuantity !== undefined)
    formData.append("stockQuantity", input.stockQuantity);
  if (input.categoryIds !== undefined) {
    formData.append("categoryIds", JSON.stringify(input.categoryIds));
  }
  if (input.sizes !== undefined) {
    formData.append("sizes", JSON.stringify(input.sizes));
  }
  if (input.colors !== undefined) {
    formData.append("colors", JSON.stringify(input.colors));
  }
  if (input.keepImageKeys !== undefined) {
    formData.append("keepImageKeys", JSON.stringify(input.keepImageKeys));
  }
  if (input.newImages && input.newImages.length > 0) {
    for (const image of input.newImages) {
      formData.append("newImages", image);
    }
  }

  const { data } = await $fetchAndThrow(`/products/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: formData,
    output: successResSchema(ProductExtendedSchema),
  });

  return data ?? null;
};

export const deleteProduct = async (id: string) => {
  const { data } = await $fetchAndThrow(`/products/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    output: successResSchema(ProductExtendedSchema),
  });

  return data ?? null;
};
