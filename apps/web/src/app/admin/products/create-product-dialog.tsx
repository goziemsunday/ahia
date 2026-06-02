"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useComboboxAnchor } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { cancelToastEl } from "@/components/ui/sonner";
import { createAdminProduct } from "@/features/admin/actions";
import { getAdminCategories } from "@/features/admin/queries";
import { getUser } from "@/features/user/queries";
import { queryKeys } from "@/lib/query-keys";
import { getApiError } from "@/lib/utils";

import { ProductFormFields } from "./product-form-fields";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProductDialog({
  open,
  onOpenChange,
}: CreateProductDialogProps) {
  const queryClient = useQueryClient();
  const anchorRef = useComboboxAnchor();

  const { data: user } = useQuery({
    queryKey: queryKeys.user(),
    queryFn: () => getUser(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: queryKeys.adminCategories({ page: 1, limit: 200 }),
    queryFn: () => getAdminCategories({ page: 1, limit: 200 }),
    enabled: open,
  });

  const categories = categoriesData?.categories ?? ([] as const);

  const getSelectedCategories = (categoryIds: string[]) => {
    return categories.filter((c) => categoryIds.includes(c.id));
  };

  const sizeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const colorInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const createMutation = useMutation({
    mutationFn: createAdminProduct,
    onSuccess: async () => {
      toast.success("Product created successfully", cancelToastEl);
      onOpenChange(false);
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminProducts(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminCategories(),
      });
    },
    onError: (err) => {
      toast.error(
        getApiError(err) || "Failed to create product.",
        cancelToastEl,
      );
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      price: "",
      stockQuantity: "",
      sizes: [] as { name: string; inStock: boolean }[],
      colors: [] as { name: string; inStock: boolean }[],
      categoryIds: [] as string[],
      images: [] as File[],
    },
    onSubmit: async ({ value }) => {
      if (!user) return;
      await createMutation.mutateAsync({
        name: value.name,
        description: value.description || undefined,
        price: Number(value.price).toFixed(2),
        stockQuantity: value.stockQuantity,
        sizes: value.sizes.length > 0 ? value.sizes : undefined,
        colors: value.colors.length > 0 ? value.colors : undefined,
        categoryIds: value.categoryIds,
        images: value.images,
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create new product</DialogTitle>
          <DialogDescription>
            Fill in the product details. Images, name, price, stock and at least
            one category are required.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await form.handleSubmit();
          }}
          className="flex flex-col"
        >
          <div className="-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4 pb-4">
            <ProductFormFields
              form={form}
              isPending={createMutation.isPending}
              categories={categories}
              getSelectedCategories={getSelectedCategories}
              sizeInputRefs={sizeInputRefs}
              colorInputRefs={colorInputRefs}
              anchorRef={anchorRef}
            />

            {/* Images — unique to create dialog */}
            <form.Field
              name="images"
              validators={{
                onChange: ({ value }) => {
                  if (!value || value.length === 0)
                    return "At least 1 image is required";
                  if (value.length > 3) return "Maximum 3 images allowed";
                  return undefined;
                },
              }}
            >
              {(field) => (
                <Field
                  data-invalid={
                    field.state.meta.errors.length > 0 ? true : undefined
                  }
                >
                  <FieldLabel>Product images</FieldLabel>
                  <ImagePicker
                    value={field.state.value}
                    onChange={(files) => field.handleChange(files)}
                    maxFiles={3}
                    disabled={createMutation.isPending}
                    error={
                      field.state.meta.errors.length > 0
                        ? field.state.meta.errors.join(", ")
                        : undefined
                    }
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={
                    !canSubmit || isSubmitting || createMutation.isPending
                  }
                >
                  {isSubmitting || createMutation.isPending
                    ? "Creating..."
                    : "Create product"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
