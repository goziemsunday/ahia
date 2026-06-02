"use client";

import {
  AccountSetting01Icon,
  DashboardSquare01Icon,
  Home03Icon,
  LabelIcon,
  Logout01Icon,
  ShoppingBag01Icon,
  ShoppingBasketSecure01Icon,
  ShoppingCart01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { ThemeSubMenu } from "@/components/theme/theme-sub-menu";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cancelToastEl } from "@/components/ui/sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getUser } from "@/features/user/queries";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/query-keys";
import { truncateEmail } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const navItems = [
  {
    title: "Overview",
    url: "/admin/overview",
    icon: DashboardSquare01Icon,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: UserMultipleIcon,
  },
  {
    title: "Categories",
    url: "/admin/categories",
    icon: LabelIcon,
  },
  {
    title: "Products",
    url: "/admin/products",
    icon: ShoppingBag01Icon,
  },
  {
    title: "Orders",
    url: "/admin/orders",
    icon: ShoppingCart01Icon,
  },
];

export const AdminSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { isMobile, setOpenMobile } = useSidebar();

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

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className=""
              size={"lg"}
              render={<Link href="/admin" />}
            >
              <div className="rounded-lg bg-foreground p-1.5 text-background">
                <HugeiconsIcon
                  icon={ShoppingBasketSecure01Icon}
                  className="size-5!"
                />
              </div>
              <span className="text-base font-semibold">Ahia Admin</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setOpenMobile(false)}
                      render={<Link href={item.url} />}
                    >
                      <HugeiconsIcon icon={item.icon} className="size-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {user ? (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    />
                  }
                >
                  <UserAvatar
                    user={user}
                    size="sm"
                    className="shrink-0 rounded-lg border bg-muted text-muted-foreground"
                    intensity3d="none"
                  />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate text-sm font-medium text-foreground">
                      {user.name}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {truncateEmail(user.email)}
                    </span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="min-w-56"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                      <UserAvatar
                        user={user}
                        size="lg"
                        className="shrink-0 rounded-lg border bg-muted text-muted-foreground"
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
                    <DropdownMenuItem render={<Link href="/" />}>
                      <HugeiconsIcon icon={Home03Icon} className="size-4" />
                      Storefront
                    </DropdownMenuItem>
                    <ThemeSubMenu />
                    <DropdownMenuItem render={<Link href="/settings" />}>
                      <HugeiconsIcon
                        icon={AccountSetting01Icon}
                        className="size-4"
                      />
                      Settings
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  {/* Sign out */}
                  <DropdownMenuItem variant="destructive" onClick={signOutUser}>
                    <HugeiconsIcon icon={Logout01Icon} className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
};
