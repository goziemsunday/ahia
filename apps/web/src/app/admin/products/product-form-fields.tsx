"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AnyFieldApi } from "@tanstack/react-form";
import { type RefObject } from "react";

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
} from "@/components/ui/combobox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Category = { id: string; name: string };
type ProductFormLike = any;

interface ProductFormFieldsProps {
  form: ProductFormLike;
  isPending: boolean;
  categories: readonly Category[];
  getSelectedCategories: (categoryIds: string[]) => Category[];
  sizeInputRefs: RefObject<(HTMLInputElement | null)[]>;
  colorInputRefs: RefObject<(HTMLInputElement | null)[]>;
  anchorRef: RefObject<HTMLDivElement | null>;
}

export function ProductFormFields({
  form,
  isPending,
  categories,
  getSelectedCategories,
  sizeInputRefs,
  colorInputRefs,
  anchorRef,
}: ProductFormFieldsProps) {
  return (
    <FieldGroup>
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }: { value: string }) => {
            if (!value) return "Name is required";
            if (value.length < 1) return "Name must be at least 1 character";
            return undefined;
          },
        }}
      >
        {(field: AnyFieldApi) => (
          <Field
            data-invalid={field.state.meta.errors.length > 0 ? true : undefined}
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
              disabled={isPending}
            />
            {field.state.meta.errors.length > 0 && (
              <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
            )}
          </Field>
        )}
      </form.Field>

      <form.Field name="description">
        {(field: AnyFieldApi) => (
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
              disabled={isPending}
              className="resize-none"
            />
          </Field>
        )}
      </form.Field>

      <div className="grid grid-cols-2 gap-3">
        <form.Field
          name="price"
          validators={{
            onChange: ({ value }: { value: string }) => {
              if (!value) return "Price is required";
              const num = Number(value);
              if (Number.isNaN(num) || num <= 0)
                return "Price must be a positive number";
              return undefined;
            },
          }}
        >
          {(field: AnyFieldApi) => (
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
                disabled={isPending}
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              {field.state.meta.errors.length > 0 && (
                <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
              )}
            </Field>
          )}
        </form.Field>

        <form.Field
          name="stockQuantity"
          validators={{
            onChange: ({ value }: { value: string }) => {
              if (!value && value !== "0") return "Stock is required";
              const num = Number(value);
              if (Number.isNaN(num) || num < 0 || !Number.isInteger(num))
                return "Must be a non-negative integer";
              return undefined;
            },
          }}
        >
          {(field: AnyFieldApi) => (
            <Field
              data-invalid={
                field.state.meta.errors.length > 0 ? true : undefined
              }
            >
              <FieldLabel htmlFor={field.name}>Stock quantity</FieldLabel>
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
                disabled={isPending}
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              {field.state.meta.errors.length > 0 && (
                <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
              )}
            </Field>
          )}
        </form.Field>
      </div>

      <form.Field
        name="sizes"
        validators={{
          onChange: ({
            value,
            fieldApi,
          }: {
            value: { name: string; inStock: boolean }[];
            fieldApi: AnyFieldApi;
          }) => {
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
        {(field: AnyFieldApi) => (
          <Field>
            <FieldLabel>
              Sizes{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </FieldLabel>
            <div className="flex flex-col gap-2">
              {field.state.value.map(
                (size: { name: string; inStock: boolean }, index: number) => (
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
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant={size.inStock ? "default" : "outline"}
                      className="shrink-0"
                      disabled={isPending}
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
                      disabled={isPending}
                      onClick={() =>
                        field.handleChange(
                          field.state.value.filter(
                            (_: unknown, i: number) => i !== index,
                          ),
                        )
                      }
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                    </Button>
                  </ButtonGroup>
                ),
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={
                  isPending ||
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
                    sizeInputRefs.current[field.state.value.length]?.focus();
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

      <form.Field
        name="colors"
        validators={{
          onChange: ({
            value,
            fieldApi,
          }: {
            value: { name: string; inStock: boolean }[];
            fieldApi: AnyFieldApi;
          }) => {
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
        {(field: AnyFieldApi) => (
          <Field>
            <FieldLabel>
              Colors{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </FieldLabel>
            <div className="flex flex-col gap-2">
              {field.state.value.map(
                (color: { name: string; inStock: boolean }, index: number) => (
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
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant={color.inStock ? "default" : "outline"}
                      className="shrink-0"
                      disabled={isPending}
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
                      disabled={isPending}
                      onClick={() =>
                        field.handleChange(
                          field.state.value.filter(
                            (_: unknown, i: number) => i !== index,
                          ),
                        )
                      }
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                    </Button>
                  </ButtonGroup>
                ),
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={
                  isPending ||
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
                    colorInputRefs.current[field.state.value.length]?.focus();
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

      <form.Field
        name="categoryIds"
        validators={{
          onChange: ({ value }: { value: string[] }) => {
            if (!value || value.length === 0)
              return "At least one category is required";
            return undefined;
          },
        }}
      >
        {(field: AnyFieldApi) => {
          const selectedCategories = getSelectedCategories(field.state.value);
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
                onValueChange={(val: Category[]) => {
                  field.handleChange(val.map((c) => c.id));
                }}
                itemToStringValue={(c: Category) => c.name}
                isItemEqualToValue={(a: Category, b: Category) => a.id === b.id}
              >
                <ComboboxChips ref={anchorRef}>
                  <ComboboxValue>
                    {selectedCategories.map((cat) => (
                      <ComboboxChip key={cat.id}>{cat.name}</ComboboxChip>
                    ))}
                  </ComboboxValue>
                  <ComboboxChipsInput
                    placeholder={
                      field.state.value.length === 0
                        ? "Search categories..."
                        : ""
                    }
                    disabled={isPending}
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
                <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
              )}
            </Field>
          );
        }}
      </form.Field>
    </FieldGroup>
  );
}
