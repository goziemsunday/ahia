"use client";

import {
  AccountSetting01Icon,
  Cancel01Icon,
  DashboardSquare01Icon,
  Home01Icon,
  Login01Icon,
  Logout01Icon,
  Menu01Icon,
  ShoppingBag01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { ThemeInlineSwitcher } from "@/components/theme/theme-inline-switcher";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getUser } from "@/features/user/queries";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";
import { cn, roles, truncateEmail } from "@/lib/utils";

import { cancelToastEl } from "../ui/sonner";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home01Icon },
  { href: "/shop", label: "Shop", icon: ShoppingBag01Icon },
];

export const MobileNav = ({ children }: { children?: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <HugeiconsIcon icon={Menu01Icon} className="size-4.5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DrawerTrigger>

      <DrawerContent className="h-full w-[80vw] border-r-0 sm:w-80">
        {/* Header */}
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border/30 px-5 py-4">
          <DrawerTitle className="text-lg font-bold tracking-tight">
            Ahia
          </DrawerTitle>
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        </DrawerHeader>

        {/* Navigation Links */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground",
                pathname === link.href && "bg-muted/60 text-foreground",
              )}
            >
              <HugeiconsIcon
                icon={link.icon}
                className="size-4.5 text-muted-foreground"
              />
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Theme Switcher */}
        <div className="border-t border-border/30 px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Theme
            </span>
            <ThemeInlineSwitcher />
          </div>
        </div>

        {/* Footer — User section */}
        <div className="border-t border-border/30 px-3 py-4">{children}</div>
      </DrawerContent>
    </Drawer>
  );
};

export const MobileNavUserContent = () => {
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

  if (user) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-3 px-3 py-3">
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
        </div>

        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <HugeiconsIcon
            icon={AccountSetting01Icon}
            className="size-4.5 text-muted-foreground"
          />
          Settings
        </Link>

        {(user.role === roles.ADMIN || user.role === roles.SUPERADMIN) && (
          <Link
            href="/admin/overview"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <HugeiconsIcon
              icon={DashboardSquare01Icon}
              className="size-4.5 text-muted-foreground"
            />
            Admin Dashboard
          </Link>
        )}

        <button
          onClick={signOutUser}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <HugeiconsIcon
            icon={Logout01Icon}
            className="size-4.5 text-muted-foreground"
          />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Link
        href="/sign-in"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <HugeiconsIcon
          icon={Login01Icon}
          className="size-4.5 text-muted-foreground"
        />
        Sign In
      </Link>
      <Link
        href="/register"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <HugeiconsIcon
          icon={UserCircleIcon}
          className="size-4.5 text-primary/60"
        />
        Create account
      </Link>
    </div>
  );
};

export const MobileNavUserFallback = () => {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-3 px-3 py-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="mt-0.5 mb-0.5 h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
};
