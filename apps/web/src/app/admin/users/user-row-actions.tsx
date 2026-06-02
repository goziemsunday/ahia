"use client";

import {
  MoreVerticalCircle01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { User } from "@repo/db/schemas/auth.schema";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cancelToastEl } from "@/components/ui/sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AdminUserRow } from "@/features/admin/queries";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";
import { roles } from "@/lib/utils";

interface UserRowActionsProps {
  user: AdminUserRow;
  currentUser: User;
}

type ActionType =
  | "set-role"
  | "set-password"
  | "ban-toggle"
  | "revoke-sessions"
  | "remove-user"
  | "update-user";

export function UserRowActions({ user, currentUser }: UserRowActionsProps) {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const canModify =
    currentUser.role === roles.SUPERADMIN ||
    (currentUser.role === roles.ADMIN && user.role === roles.USER);

  const canChangeRole =
    user.role !== roles.SUPERADMIN && currentUser.role === roles.SUPERADMIN;

  const handleSetRole = async (newRole: "admin" | "user") => {
    await authClient.admin.setRole(
      {
        userId: user.id,
        role: newRole,
      },
      {
        onRequest() {
          setIsLoading(true);
        },
        onSuccess: async () => {
          setIsLoading(false);
          setOpenDialog(false);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.adminUsers(),
          });
        },
        onError(ctx) {
          setIsLoading(false);
          toast.error(
            ctx.error.message || "Failed to change role. Please try again.",
            cancelToastEl,
          );
        },
        onSettled() {
          setIsLoading(false);
          setPendingAction(null);
        },
      },
    );
  };

  const passwordForm = useForm({
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.newPassword !== value.confirmNewPassword) {
        toast.error("Passwords do not match", cancelToastEl);
        return;
      }

      if (value.newPassword.length < 8) {
        toast.error("Password must be at least 8 characters", cancelToastEl);
        return;
      }

      await authClient.admin.setUserPassword(
        {
          userId: user.id,
          newPassword: value.newPassword,
        },
        {
          onRequest() {
            setIsLoading(true);
          },
          onSuccess: async () => {
            toast.success("Password set successfully", cancelToastEl);
            setOpenDialog(false);
            passwordForm.reset();
            await queryClient.invalidateQueries({
              queryKey: queryKeys.adminUsers(),
            });
          },
          onError(ctx) {
            setIsLoading(false);
            toast.error(
              ctx.error.message || "Failed to set password. Please try again.",
              cancelToastEl,
            );
          },
          onSettled() {
            setIsLoading(false);
            setPendingAction(null);
          },
        },
      );
    },
  });

  const newRole = user.role === roles.ADMIN ? roles.USER : roles.ADMIN;
  const actionLabel =
    user.role === roles.ADMIN ? "Set as user" : "Set as admin";
  const canRevokeSessions = canModify && user.id !== currentUser.id;
  const canBan = canModify && user.id !== currentUser.id;
  const canRemove =
    currentUser.role === roles.SUPERADMIN &&
    user.role !== roles.SUPERADMIN &&
    user.id !== currentUser.id;

  const handleRevokeSessions = async () => {
    await authClient.admin.revokeUserSessions(
      { userId: user.id },
      {
        onRequest() {
          setIsLoading(true);
        },
        onSuccess: async () => {
          setOpenDialog(false);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.adminUsers(),
          });
        },
        onError(ctx) {
          setIsLoading(false);
          toast.error(
            ctx.error.message || "Failed to revoke sessions. Please try again.",
            cancelToastEl,
          );
        },
        onSettled() {
          setIsLoading(false);
          setPendingAction(null);
        },
      },
    );
  };

  const handleBanToggle = async () => {
    const banUser = async () => {
      await authClient.admin.banUser(
        { userId: user.id },
        {
          onRequest() {
            setIsLoading(true);
          },
          onSuccess: async () => {
            setOpenDialog(false);
            await queryClient.invalidateQueries({
              queryKey: queryKeys.adminUsers(),
            });
          },
          onError(ctx) {
            setIsLoading(false);
            toast.error(
              ctx.error.message || "Failed to ban user. Please try again.",
              cancelToastEl,
            );
          },
          onSettled() {
            setIsLoading(false);
            setPendingAction(null);
          },
        },
      );
    };
    const unbanUser = async () => {
      await authClient.admin.unbanUser(
        { userId: user.id },
        {
          onRequest() {
            setIsLoading(true);
          },
          onSuccess: async () => {
            setOpenDialog(false);
            await queryClient.invalidateQueries({
              queryKey: queryKeys.adminUsers(),
            });
          },
          onError(ctx) {
            setIsLoading(false);
            toast.error(
              ctx.error.message || "Failed to unban user. Please try again.",
              cancelToastEl,
            );
          },
          onSettled() {
            setIsLoading(false);
            setPendingAction(null);
          },
        },
      );
    };

    if (user.banned) {
      await unbanUser();
    } else {
      await banUser();
    }
  };

  const handleRemoveUser = async () => {
    await authClient.admin.removeUser(
      { userId: user.id },
      {
        onRequest() {
          setIsLoading(true);
        },
        onSuccess: async () => {
          setOpenDialog(false);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.adminUsers(),
          });
        },
        onError(ctx) {
          setIsLoading(false);
          toast.error(
            ctx.error.message || "Failed to remove user. Please try again.",
            cancelToastEl,
          );
        },
        onSettled() {
          setIsLoading(false);
          setPendingAction(null);
        },
      },
    );
  };

  const updateUserForm = useForm({
    defaultValues: {
      name: user.name ?? "",
      image: user.image ?? "",
    },
    onSubmit: async ({ value }) => {
      await authClient.admin.updateUser(
        {
          userId: user.id,
          data: {
            name: value.name,
            image: value.image === "" ? null : value.image,
          },
        },
        {
          onRequest() {
            setIsLoading(true);
          },
          onSuccess: async () => {
            setOpenDialog(false);
            await queryClient.invalidateQueries({
              queryKey: queryKeys.adminUsers(),
            });
          },
          onError(ctx) {
            setIsLoading(false);
            toast.error(
              ctx.error.message || "Failed to update user. Please try again.",
              cancelToastEl,
            );
          },
          onSettled() {
            setIsLoading(false);
            setPendingAction(null);
          },
        },
      );
    },
  });

  const handleClearImage = async () => {
    await authClient.admin.updateUser(
      {
        userId: user.id,
        data: {
          name: updateUserForm.getFieldValue("name"),
          image: null,
        },
      },
      {
        onRequest() {
          setIsClearing(true);
        },
        onSuccess: async () => {
          updateUserForm.setFieldValue("image", "");
          await queryClient.invalidateQueries({
            queryKey: queryKeys.adminUsers(),
          });
        },
        onError(ctx) {
          setIsClearing(false);
          toast.error(
            ctx.error.message || "Failed to clear image. Please try again.",
            cancelToastEl,
          );
        },
        onSettled() {
          setIsClearing(false);
        },
      },
    );
  };

  return (
    <>
      {canModify ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={`Open options for ${user.name}`}
                size="icon"
                variant="ghost"
              >
                <HugeiconsIcon
                  icon={MoreVerticalCircle01Icon}
                  className="size-4"
                />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuGroup>
              {canChangeRole ? (
                <DropdownMenuItem
                  onClick={() => {
                    setPendingAction("set-role");
                    setOpenDialog(true);
                  }}
                >
                  {actionLabel}
                </DropdownMenuItem>
              ) : null}

              {canModify ? (
                <DropdownMenuItem
                  onClick={() => {
                    setPendingAction("set-password");
                    setOpenDialog(true);
                    passwordForm.reset();
                  }}
                >
                  Set user password
                </DropdownMenuItem>
              ) : null}

              {canModify ? (
                <DropdownMenuItem
                  onClick={() => {
                    setPendingAction("update-user");
                    setOpenDialog(true);
                    updateUserForm.reset();
                  }}
                >
                  Update user
                </DropdownMenuItem>
              ) : null}

              {canRevokeSessions ? (
                <DropdownMenuItem
                  onClick={() => {
                    setPendingAction("revoke-sessions");
                    setOpenDialog(true);
                  }}
                >
                  Revoke user sessions
                </DropdownMenuItem>
              ) : null}

              {canBan ? (
                <DropdownMenuItem
                  onClick={() => {
                    setPendingAction("ban-toggle");
                    setOpenDialog(true);
                  }}
                  variant={user.banned ? undefined : "destructive"}
                >
                  {user.banned ? "Unban user" : "Ban user"}
                </DropdownMenuItem>
              ) : null}

              {canRemove ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setPendingAction("remove-user");
                      setOpenDialog(true);
                    }}
                  >
                    Remove user
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {/* Confirmation Dialog for Role Change */}
      {pendingAction === "set-role" && (
        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Change User Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to change{" "}
                <span className="font-semibold text-secondary-foreground">
                  {user.name}
                </span>
                's role from{" "}
                <span className="font-semibold text-secondary-foreground">
                  {user.role}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-secondary-foreground">
                  {newRole}
                </span>
                ? This action cannot be undone immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isLoading}
                onClick={async (e) => {
                  e.preventDefault();
                  await handleSetRole(newRole as "admin" | "user");
                }}
              >
                {isLoading ? "Changing..." : "Change Role"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Confirmation Dialog for Ban/Unban */}
      {pendingAction === "ban-toggle" && (
        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {user.banned ? "Unban User" : "Ban User"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {user.banned ? (
                  <>
                    Are you sure you want to unban{" "}
                    <span className="font-semibold text-secondary-foreground">
                      {user.name}
                    </span>
                    ? They will be able to sign in again.
                  </>
                ) : (
                  <>
                    Are you sure you want to ban{" "}
                    <span className="font-semibold text-secondary-foreground">
                      {user.name}
                    </span>
                    ? They will be immediately signed out and unable to sign in.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isLoading}
                variant={user.banned ? "default" : "destructive"}
                onClick={async (e) => {
                  e.preventDefault();
                  await handleBanToggle();
                }}
              >
                {isLoading
                  ? user.banned
                    ? "Unbanning..."
                    : "Banning..."
                  : user.banned
                    ? "Unban User"
                    : "Ban User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Confirmation Dialog for Revoking Sessions */}
      {pendingAction === "revoke-sessions" && (
        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke User Sessions</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to revoke all sessions for{" "}
                <span className="font-semibold text-secondary-foreground">
                  {user.name}
                </span>
                ? They will be signed out of all devices immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isLoading}
                variant="destructive"
                onClick={async (e) => {
                  e.preventDefault();
                  await handleRevokeSessions();
                }}
              >
                {isLoading ? "Revoking..." : "Revoke Sessions"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Confirmation Dialog for Removing User */}
      {pendingAction === "remove-user" && (
        <AlertDialog open={openDialog} onOpenChange={setOpenDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently remove{" "}
                <span className="font-semibold text-secondary-foreground">
                  {user.name}
                </span>
                ? This will hard-delete their account and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isLoading}
                variant="destructive"
                onClick={async (e) => {
                  e.preventDefault();
                  await handleRemoveUser();
                }}
              >
                {isLoading ? "Removing..." : "Remove User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Dialog for Setting User Password */}
      {pendingAction === "set-password" && (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Password for {user.name}</DialogTitle>
              <DialogDescription>
                Enter a new password for this user. The password must be at
                least 8 characters.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await passwordForm.handleSubmit();
              }}
              className="flex flex-col gap-4"
            >
              <FieldGroup>
                {/* New Password */}
                <passwordForm.Field
                  name="newPassword"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Password is required";
                      if (value.length < 8)
                        return "Password must be at least 8 characters";
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
                        New Password
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id={field.name}
                          name={field.name}
                          type={showPassword ? "text" : "password"}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Enter new password"
                          disabled={isLoading}
                          aria-invalid={field.state.meta.errors.length > 0}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            <HugeiconsIcon
                              icon={showPassword ? ViewOffIcon : ViewIcon}
                              className="size-4"
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

                {/* Confirm Password */}
                <passwordForm.Field
                  name="confirmNewPassword"
                  validators={{
                    onChangeListenTo: ["newPassword"],
                    onChange: ({ value, fieldApi }) => {
                      if (!value) return "Please confirm the password";
                      if (value !== fieldApi.form.getFieldValue("newPassword"))
                        return "Passwords do not match";
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
                        Confirm Password
                      </FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          id={field.name}
                          name={field.name}
                          type={showConfirmPassword ? "text" : "password"}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Confirm password"
                          disabled={isLoading}
                          aria-invalid={field.state.meta.errors.length > 0}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            disabled={isLoading}
                            aria-label={
                              showConfirmPassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            <HugeiconsIcon
                              icon={
                                showConfirmPassword ? ViewOffIcon : ViewIcon
                              }
                              className="size-4"
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

              <DialogFooter>
                <Button
                  disabled={isLoading}
                  variant="outline"
                  onClick={() => setOpenDialog(false)}
                >
                  Cancel
                </Button>
                <Button disabled={isLoading} type="submit">
                  {isLoading ? "Setting..." : "Set Password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog for Updating User */}
      {pendingAction === "update-user" && (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update {user.name}</DialogTitle>
              <DialogDescription>
                Update the name or profile image URL for this user.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await updateUserForm.handleSubmit();
              }}
              className="flex flex-col gap-4"
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
                {/* Image URL */}
                <updateUserForm.Field
                  name="image"
                  validators={{
                    onChange: ({ value }) => {
                      if (value && !z.url().safeParse(value).success)
                        return "Please enter a valid URL";
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
                      <InputGroup>
                        <InputGroupInput
                          id={field.name}
                          name={field.name}
                          type="url"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://example.com/avatar.png"
                          disabled={isLoading || isClearing}
                          aria-invalid={field.state.meta.errors.length > 0}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            size="xs"
                            variant="secondary"
                            type="button"
                            onClick={handleClearImage}
                            disabled={isLoading || isClearing}
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
                </updateUserForm.Field>

                {/* Name */}
                <updateUserForm.Field
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
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Enter user name"
                        disabled={isLoading || isClearing}
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>
                          {field.state.meta.errors.join(", ")}
                        </FieldError>
                      )}
                    </Field>
                  )}
                </updateUserForm.Field>
              </FieldGroup>

              <DialogFooter>
                <Button
                  disabled={isLoading || isClearing}
                  variant="outline"
                  type="button"
                  onClick={() => setOpenDialog(false)}
                >
                  Cancel
                </Button>
                <updateUserForm.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isSubmitting]) => (
                    <Button
                      type="submit"
                      disabled={
                        !canSubmit || isSubmitting || isLoading || isClearing
                      }
                    >
                      {isSubmitting || isLoading ? "Saving..." : "Save changes"}
                    </Button>
                  )}
                </updateUserForm.Subscribe>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
