"use client";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cancelToastEl } from "@/components/ui/sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import { changePassword, updateUser } from "@/features/user/actions";
import { getUser } from "@/features/user/queries";
import { queryKeys } from "@/lib/query-keys";
import { getApiError } from "@/lib/utils";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";

export const UserSettings = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { data: user } = useQuery({
    queryKey: queryKeys.user(),
    queryFn: () => getUser(),
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: async () => {
      toast.success("Profile updated successfully", cancelToastEl);
      await queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      router.refresh();
    },
    onError: (err) => {
      toast.error(
        getApiError(err) || "Failed to update profile",
        cancelToastEl,
      );
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      passwordForm.reset();
      await queryClient.cancelQueries({ queryKey: queryKeys.user() });
      queryClient.setQueryData(queryKeys.user(), null);
      toast.success("Password updated. Please sign in again.", cancelToastEl);
      router.replace("/sign-in");
      router.refresh();
    },
    onError: (err) => {
      toast.error(
        getApiError(err) || "Failed to update password",
        cancelToastEl,
      );
    },
  });

  const profileForm = useForm({
    defaultValues: {
      name: user?.name ?? "",
      image: user?.image ?? "",
    },
    onSubmit: async ({ value }) => {
      await updateProfileMutation.mutateAsync({
        ...value,
        image: value.image === "" ? null : value.image,
      });
    },
  });

  const handleClearImage = async () => {
    setIsClearing(true);
    try {
      await updateProfileMutation.mutateAsync({
        name: profileForm.getFieldValue("name"),
        image: null,
      });
      profileForm.setFieldValue("image", "");
    } finally {
      setIsClearing(false);
    }
  };

  const passwordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.newPassword !== value.confirmNewPassword) {
        toast.error("New passwords do not match", cancelToastEl);
        return;
      }

      await updatePasswordMutation.mutateAsync({
        newPassword: value.newPassword,
        currentPassword: value.currentPassword,
        revokeOtherSessions: true,
      });
    },
  });

  useEffect(() => {
    if (!user) {
      router.push("/sign-in");
    } else {
      // Sync form values if user data arrives late or changes
      profileForm.reset({
        name: user.name,
        image: user.image ?? "",
      });
    }
  }, [user, router, profileForm]);

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Profile section */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Update your personal information.
          </p>
        </div>

        <div className="h-px bg-border/30" />

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await profileForm.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <UserAvatar
              user={user}
              size="xl"
              className="rounded-xl border bg-muted text-muted-foreground"
            />
          </div>

          <FieldGroup>
            {/* Image */}
            <profileForm.Field
              name="image"
              validators={{
                onChange: ({ value }) => {
                  if (value && !z.url().safeParse(value).success) {
                    return "Please enter a valid URL";
                  }
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
                  <FieldLabel
                    htmlFor={field.name}
                    className="text-sm font-medium"
                  >
                    Image URL
                  </FieldLabel>
                  <InputGroup className="h-10 max-w-sm rounded-xl">
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      type="text"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={field.state.meta.errors.length > 0}
                      disabled={updateProfileMutation.isPending || isClearing}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size={"sm"}
                        variant={"secondary"}
                        className={"h-7 rounded-md"}
                        onClick={handleClearImage}
                        disabled={updateProfileMutation.isPending || isClearing}
                      >
                        {isClearing ? "Clearing..." : "Clear"}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors.join(", ")}
                    </FieldError>
                  )}
                </Field>
              )}
            </profileForm.Field>

            {/* Name */}
            <profileForm.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Name is required";
                  if (value.length < 2)
                    return "Name must be at least 2 characters";
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
                  <FieldLabel
                    htmlFor={field.name}
                    className="text-sm font-medium"
                  >
                    Name
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-10 max-w-sm rounded-xl"
                    aria-invalid={field.state.meta.errors.length > 0}
                    disabled={updateProfileMutation.isPending || isClearing}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors.join(", ")}
                    </FieldError>
                  )}
                </Field>
              )}
            </profileForm.Field>

            {/* Email — read only */}
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="email" className="text-sm font-medium">
                Email
              </FieldLabel>
              <Input
                id="email"
                type="email"
                defaultValue={user.email}
                disabled
                className="h-10 max-w-sm rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">
                Email cannot be changed. Contact support if you need help.
              </p>
            </div>
          </FieldGroup>

          <div>
            <profileForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    updateProfileMutation.isPending ||
                    isClearing
                  }
                  className="rounded-full px-6 text-xs font-semibold"
                >
                  {isSubmitting || updateProfileMutation.isPending
                    ? "Saving..."
                    : "Save changes"}
                </Button>
              )}
            </profileForm.Subscribe>
          </div>
        </form>
      </section>

      {/* Password section */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Password</h2>
          <p className="text-sm text-muted-foreground">
            Update your account password.
          </p>
        </div>

        <div className="h-px bg-border/30" />

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await passwordForm.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <passwordForm.Field
              name="currentPassword"
              validators={{
                onChange: ({ value }) =>
                  !value ? "Current password is required" : undefined,
              }}
            >
              {(field) => (
                <Field
                  data-invalid={
                    field.state.meta.errors.length > 0 ? true : undefined
                  }
                >
                  <FieldLabel
                    htmlFor={field.name}
                    className="text-sm font-medium"
                  >
                    Current password
                  </FieldLabel>
                  <InputGroup className="h-10 max-w-sm rounded-xl">
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      type={showCurrentPassword ? "text" : "password"}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={field.state.meta.errors.length > 0}
                      disabled={updatePasswordMutation.isPending}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size={"icon-sm"}
                        className="h-7 rounded-md"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                      >
                        <HugeiconsIcon
                          icon={showCurrentPassword ? ViewOffIcon : ViewIcon}
                          className="size-4.5"
                        />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors.join(", ")}
                    </FieldError>
                  )}
                </Field>
              )}
            </passwordForm.Field>

            <passwordForm.Field
              name="newPassword"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "New password is required";
                  if (value.length < 8) return "Must be at least 8 characters";
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
                  <FieldLabel
                    htmlFor={field.name}
                    className="text-sm font-medium"
                  >
                    New password
                  </FieldLabel>
                  <InputGroup className="h-10 max-w-sm rounded-xl">
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      type={showNewPassword ? "text" : "password"}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={field.state.meta.errors.length > 0}
                      disabled={updatePasswordMutation.isPending}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size={"icon-sm"}
                        className="h-7 rounded-md"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                      >
                        <HugeiconsIcon
                          icon={showNewPassword ? ViewOffIcon : ViewIcon}
                          className="size-4.5"
                        />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors.join(", ")}
                    </FieldError>
                  )}
                </Field>
              )}
            </passwordForm.Field>

            <passwordForm.Field
              name="confirmNewPassword"
              validators={{
                onChangeListenTo: ["newPassword"],
                onChange: ({ value, fieldApi }) => {
                  if (!value) return "Please confirm your new password";
                  if (value !== fieldApi.form.getFieldValue("newPassword")) {
                    return "Passwords do not match";
                  }
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
                  <FieldLabel
                    htmlFor={field.name}
                    className="text-sm font-medium"
                  >
                    Confirm new password
                  </FieldLabel>
                  <InputGroup className="h-10 max-w-sm rounded-xl">
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      type={showConfirmNewPassword ? "text" : "password"}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={field.state.meta.errors.length > 0}
                      disabled={updatePasswordMutation.isPending}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size={"icon-sm"}
                        className="h-7 rounded-md"
                        onClick={() =>
                          setShowConfirmNewPassword((prev) => !prev)
                        }
                      >
                        <HugeiconsIcon
                          icon={showConfirmNewPassword ? ViewOffIcon : ViewIcon}
                          className="size-4.5"
                        />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>
                      {field.state.meta.errors.join(", ")}
                    </FieldError>
                  )}
                </Field>
              )}
            </passwordForm.Field>
          </FieldGroup>

          <div>
            <passwordForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    updatePasswordMutation.isPending
                  }
                  className="rounded-full px-6 text-xs font-semibold"
                >
                  {isSubmitting || updatePasswordMutation.isPending
                    ? "Updating..."
                    : "Update password"}
                </Button>
              )}
            </passwordForm.Subscribe>
          </div>
        </form>
      </section>
    </>
  );
};
