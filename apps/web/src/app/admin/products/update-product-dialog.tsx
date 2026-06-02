"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import { UpdateImagePicker } from "@/components/ui/image-picker";
import { cancelToastEl } from "@/components/ui/sonner";
import { updateAdminProduct } from "@/features/admin/actions";
import {
  getAdminCategories,
  type AdminProductRow,
} from "@/features/admin/queries";
import { queryKeys } from "@/lib/query-keys";
import { getApiError } from "@/lib/utils";

import { ProductFormFields } from "./product-form-fields";

interface UpdateProductDialogProps {
  product: AdminProductRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateProductDialog({
  product,
  open,
  onOpenChange,
}: UpdateProductDialogProps) {
  const queryClient = useQueryClient();
  const anchorRef = useComboboxAnchor();

  // track which existing images to keep and which new files to add
  const [keepImages, setKeepImages] = useState(product.images);
  const [newFiles, setNewFiles] = useState<File[]>([]);

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

  const updateMutation = useMutation({
    mutationFn: updateAdminProduct,
    onSuccess: async () => {
      toast.success("Product updated successfully", cancelToastEl);
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminProducts(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminCategories(),
      });
    },
    onError: (err) => {
      toast.error(
        getApiError(err) || "Failed to update product.",
        cancelToastEl,
      );
    },
  });

  const form = useForm({
    defaultValues: {
      name: product.name,
      description: product.description ?? "",
      price: product.price,
      stockQuantity: String(product.stockQuantity ?? 0),
      sizes: (product.sizes ?? []) as { name: string; inStock: boolean }[],
      colors: (product.colors ?? []) as { name: string; inStock: boolean }[],
      categoryIds: product.categories.map((c) => c.id),
    },
    onSubmit: async ({ value }) => {
      const totalImages = keepImages.length + newFiles.length;
      if (totalImages < 1) {
        toast.error("At least 1 image is required", cancelToastEl);
        return;
      }
      if (totalImages > 3) {
        toast.error("Maximum 3 images allowed", cancelToastEl);
        return;
      }

      await updateMutation.mutateAsync({
        id: product.id,
        input: {
          name: value.name,
          description: value.description || undefined,
          price: Number(value.price).toFixed(2),
          stockQuantity: value.stockQuantity,
          sizes: value.sizes,
          colors: value.colors,
          categoryIds: value.categoryIds,
          keepImageKeys: keepImages.map((img) => img.key),
          newImages: newFiles.length > 0 ? newFiles : undefined,
        },
      });
    },
  });

  const handleExistingRemove = (key: string) => {
    setKeepImages((prev) => prev.filter((img) => img.key !== key));
  };

  const resetState = () => {
    form.reset();
    setKeepImages(product.images);
    setNewFiles([]);
  };

  const imageError = (() => {
    const total = keepImages.length + newFiles.length;
    if (total === 0) return "At least 1 image is required";
    if (total > 3) return "Maximum 3 images allowed";
    return undefined;
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetState();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update product</DialogTitle>
          <DialogDescription>
            Edit product details. You can keep, remove, or add new images.
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
              isPending={updateMutation.isPending}
              categories={categories}
              getSelectedCategories={getSelectedCategories}
              sizeInputRefs={sizeInputRefs}
              colorInputRefs={colorInputRefs}
              anchorRef={anchorRef}
            />

            {/* Images — unique to update dialog */}
            <Field data-invalid={imageError ? true : undefined}>
              <FieldLabel>Product images</FieldLabel>
              <UpdateImagePicker
                existingImages={keepImages}
                newFiles={newFiles}
                onExistingRemove={handleExistingRemove}
                onNewFilesChange={setNewFiles}
                maxFiles={3}
                disabled={updateMutation.isPending}
                error={imageError}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={updateMutation.isPending}
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
                    !canSubmit ||
                    isSubmitting ||
                    updateMutation.isPending ||
                    !!imageError
                  }
                >
                  {isSubmitting || updateMutation.isPending
                    ? "Saving..."
                    : "Save changes"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
