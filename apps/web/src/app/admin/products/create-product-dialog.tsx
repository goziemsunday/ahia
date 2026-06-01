"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ImagePicker } from "@/components/ui/image-picker";
import { Input } from "@/components/ui/input";
import { cancelToastEl } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { createAdminProduct } from "@/features/admin/actions";
import { getAdminCategories } from "@/features/admin/queries";
import { getUser } from "@/features/user/queries";
import { queryKeys } from "@/lib/query-keys";
import { getApiError } from "@/lib/utils";

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
            <FieldGroup>
              {/* Name */}
              <form.Field
                name="name"
                validators={{
                  onChange: ({ value }) => {
                    if (!value) return "Name is required";
                    if (value.length < 1)
                      return "Name must be at least 1 character";
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
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="e.g. Wireless Headphones"
                      aria-invalid={field.state.meta.errors.length > 0}
                      disabled={createMutation.isPending}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError>
                        {field.state.meta.errors.join(", ")}
                      </FieldError>
                    )}
                  </Field>
                )}
              </form.Field>

              {/* Description */}
              <form.Field name="description">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>
                      Description{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FieldLabel>
                    <Textarea
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Describe the product..."
                      disabled={createMutation.isPending}
                      className="resize-none"
                    />
                  </Field>
                )}
              </form.Field>

              {/* Price & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <form.Field
                  name="price"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Price is required";
                      const num = Number(value);
                      if (Number.isNaN(num) || num <= 0)
                        return "Price must be a positive number";
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
                      <FieldLabel htmlFor={field.name}>Price ($)</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        step="0.01"
                        min="0"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="0.00"
                        aria-invalid={field.state.meta.errors.length > 0}
                        disabled={createMutation.isPending}
                        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>
                          {field.state.meta.errors.join(", ")}
                        </FieldError>
                      )}
                    </Field>
                  )}
                </form.Field>

                <form.Field
                  name="stockQuantity"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value && value !== "0") return "Stock is required";
                      const num = Number(value);
                      if (
                        Number.isNaN(num) ||
                        num < 0 ||
                        !Number.isInteger(num)
                      )
                        return "Must be a non-negative integer";
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
                      <FieldLabel htmlFor={field.name}>
                        Stock quantity
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        step="1"
                        min="0"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="0"
                        aria-invalid={field.state.meta.errors.length > 0}
                        disabled={createMutation.isPending}
                        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>
                          {field.state.meta.errors.join(", ")}
                        </FieldError>
                      )}
                    </Field>
                  )}
                </form.Field>
              </div>

              {/* Sizes */}
              <form.Field
                name="sizes"
                validators={{
                  onChange: ({ value, fieldApi }) => {
                    if (value.length === 0) return undefined;
                    const stock = Number(
                      fieldApi.form.getFieldValue("stockQuantity") ?? 0,
                    );
                    if (stock > 0 && !value.some((s) => s.inStock)) {
                      return "At least one size must be in stock when stock quantity is greater than 0";
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <Field>
                    <FieldLabel>
                      Sizes{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FieldLabel>
                    <div className="flex flex-col gap-2">
                      {field.state.value.map((size, index) => (
                        <ButtonGroup key={index} className="w-full">
                          <Input
                            ref={(el) => {
                              sizeInputRefs.current[index] = el;
                            }}
                            value={size.name}
                            onChange={(e) => {
                              const next = [...field.state.value];
                              next[index] = {
                                ...next[index],
                                name: e.target.value,
                              };
                              field.handleChange(next);
                            }}
                            placeholder="e.g. S, M, L"
                            disabled={createMutation.isPending}
                          />
                          <Button
                            type="button"
                            variant={size.inStock ? "default" : "outline"}
                            className="shrink-0"
                            disabled={createMutation.isPending}
                            onClick={() => {
                              const next = [...field.state.value];
                              next[index] = {
                                ...next[index],
                                inStock: !next[index].inStock,
                              };
                              field.handleChange(next);
                            }}
                          >
                            <Checkbox
                              checked={size.inStock}
                              className="pointer-events-none"
                            />
                            In stock
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            disabled={createMutation.isPending}
                            onClick={() =>
                              field.handleChange(
                                field.state.value.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <HugeiconsIcon
                              icon={Cancel01Icon}
                              className="size-3.5"
                            />
                          </Button>
                        </ButtonGroup>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        disabled={
                          createMutation.isPending ||
                          (field.state.value.length > 0 &&
                            !field.state.value[
                              field.state.value.length - 1
                            ].name.trim())
                        }
                        onClick={() => {
                          field.handleChange([
                            ...field.state.value,
                            { name: "", inStock: true },
                          ]);
                          requestAnimationFrame(() => {
                            sizeInputRefs.current[
                              field.state.value.length
                            ]?.focus();
                          });
                        }}
                      >
                        Add size
                      </Button>
                    </div>
                    <FieldError />
                  </Field>
                )}
              </form.Field>

              {/* Colors */}
              <form.Field
                name="colors"
                validators={{
                  onChange: ({ value, fieldApi }) => {
                    if (value.length === 0) return undefined;
                    const stock = Number(
                      fieldApi.form.getFieldValue("stockQuantity") ?? 0,
                    );
                    if (stock > 0 && !value.some((c) => c.inStock)) {
                      return "At least one color must be in stock when stock quantity is greater than 0";
                    }
                    return undefined;
                  },
                }}
              >
                {(field) => (
                  <Field>
                    <FieldLabel>
                      Colors{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </FieldLabel>
                    <div className="flex flex-col gap-2">
                      {field.state.value.map((color, index) => (
                        <ButtonGroup key={index} className="w-full">
                          <Input
                            ref={(el) => {
                              colorInputRefs.current[index] = el;
                            }}
                            value={color.name}
                            onChange={(e) => {
                              const next = [...field.state.value];
                              next[index] = {
                                ...next[index],
                                name: e.target.value,
                              };
                              field.handleChange(next);
                            }}
                            placeholder="e.g. Red, Blue"
                            disabled={createMutation.isPending}
                          />
                          <Button
                            type="button"
                            variant={color.inStock ? "default" : "outline"}
                            className="shrink-0"
                            disabled={createMutation.isPending}
                            onClick={() => {
                              const next = [...field.state.value];
                              next[index] = {
                                ...next[index],
                                inStock: !next[index].inStock,
                              };
                              field.handleChange(next);
                            }}
                          >
                            <Checkbox
                              checked={color.inStock}
                              className="pointer-events-none"
                            />
                            In stock
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            disabled={createMutation.isPending}
                            onClick={() =>
                              field.handleChange(
                                field.state.value.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <HugeiconsIcon
                              icon={Cancel01Icon}
                              className="size-3.5"
                            />
                          </Button>
                        </ButtonGroup>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        disabled={
                          createMutation.isPending ||
                          (field.state.value.length > 0 &&
                            !field.state.value[
                              field.state.value.length - 1
                            ].name.trim())
                        }
                        onClick={() => {
                          field.handleChange([
                            ...field.state.value,
                            { name: "", inStock: true },
                          ]);
                          requestAnimationFrame(() => {
                            colorInputRefs.current[
                              field.state.value.length
                            ]?.focus();
                          });
                        }}
                      >
                        Add color
                      </Button>
                    </div>
                    <FieldError />
                  </Field>
                )}
              </form.Field>

              {/* Categories */}
              <form.Field
                name="categoryIds"
                validators={{
                  onChange: ({ value }) => {
                    if (!value || value.length === 0)
                      return "At least one category is required";
                    return undefined;
                  },
                }}
              >
                {(field) => {
                  const selectedCategories = getSelectedCategories(
                    field.state.value,
                  );
                  return (
                    <Field
                      data-invalid={
                        field.state.meta.errors.length > 0 ? true : undefined
                      }
                    >
                      <FieldLabel>Categories</FieldLabel>
                      <Combobox
                        items={categories}
                        multiple
                        value={selectedCategories}
                        onValueChange={(val) => {
                          field.handleChange(val.map((c) => c.id));
                        }}
                        itemToStringValue={(c) => c.name}
                        isItemEqualToValue={(a, b) => a.id === b.id}
                      >
                        <ComboboxChips ref={anchorRef}>
                          <ComboboxValue>
                            {selectedCategories.map((cat) => (
                              <ComboboxChip key={cat.id}>
                                {cat.name}
                              </ComboboxChip>
                            ))}
                          </ComboboxValue>
                          <ComboboxChipsInput
                            placeholder={
                              field.state.value.length === 0
                                ? "Search categories..."
                                : ""
                            }
                            disabled={createMutation.isPending}
                            aria-invalid={field.state.meta.errors.length > 0}
                          />
                        </ComboboxChips>
                        <ComboboxContent anchor={anchorRef}>
                          <ComboboxList>
                            {categories.map((cat) => (
                              <ComboboxItem key={cat.id} value={cat}>
                                {cat.name}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                          <ComboboxEmpty>No categories found.</ComboboxEmpty>
                        </ComboboxContent>
                      </Combobox>
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>
                          {field.state.meta.errors.join(", ")}
                        </FieldError>
                      )}
                    </Field>
                  );
                }}
              </form.Field>

              {/* Images */}
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
            </FieldGroup>
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
