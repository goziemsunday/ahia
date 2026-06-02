"use client";

import {
  AccountSetting01Icon,
  DashboardSquare01Icon,
  Login01Icon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ThemeSubMenu } from "@/components/theme/theme-sub-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getUser } from "@/features/user/queries";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";
import { roles, truncateEmail } from "@/lib/utils";

import { cancelToastEl } from "../ui/sonner";

export const UserMenu = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: queryKeys.user(),
    queryFn: () => getUser(),
  });

  const signOutUser = async () => {
    toast.promise(
      authClient.signOut().then(async () => {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.user(),
        });
        router.push("/sign-in");
        return undefined;
      }),
      {
        loading: "Signing out...",
        success: "Signed out successfully",
        error: "Failed to sign out. Please try again.",
        ...cancelToastEl,
      },
    );
  };

  // Guest state
  if (!user) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          className="text-muted-foreground hover:text-foreground"
          render={<Link href="/sign-in" />}
        >
          <HugeiconsIcon icon={Login01Icon} className="size-5" />
          <span className="sr-only">Sign In</span>
        </Button>
      </>
    );
  }

  // Signed-in state
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative text-foreground/80 hover:text-foreground"
          />
        }
      >
        <UserAvatar
          user={user}
          size="sm"
          className="shrink-0 rounded-md border bg-muted text-muted-foreground"
          intensity3d="none"
        />
        <span className="sr-only">User menu</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="min-w-64">
        {/* User info */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2 font-normal">
            <UserAvatar
              user={user}
              size="lg"
              className="shrink-0 rounded-xl border bg-muted text-muted-foreground"
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {truncateEmail(user.email)}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Navigation */}
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/settings" />}>
            <HugeiconsIcon icon={AccountSetting01Icon} className="size-4" />
            Settings
          </DropdownMenuItem>
          <ThemeSubMenu />

          {/* Admin-only: Dashboard link */}
          {(user.role === roles.ADMIN || user.role === roles.SUPERADMIN) && (
            <DropdownMenuItem render={<Link href="/admin/overview" />}>
              <HugeiconsIcon icon={DashboardSquare01Icon} className="size-4" />
              Admin Dashboard
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Sign out */}
        <DropdownMenuItem variant="destructive" onClick={signOutUser}>
          <HugeiconsIcon icon={Logout01Icon} className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
