import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Search } from "@/components/storefront/search";
import { Skeleton } from "@/components/ui/skeleton";
import { getUser } from "@/features/user/queries";
import { getCookie } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

import { CartDrawer } from "./cart-drawer";
import {
  MobileNav,
  MobileNavUserContent,
  MobileNavUserFallback,
} from "./mobile-nav";
import { UserMenu } from "./user-menu";

const NAV_LINKS: { href: Route; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/shop?new=true" as Route, label: "New Arrivals" },
];

export const SiteHeader = () => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-background/80 backdrop-blur-lg">
      <div className="container flex h-14 w-full items-center justify-between px-4 md:h-16 md:px-8">
        {/* Left: Mobile nav + Logo */}
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <MobileNav>
              <Suspense fallback={<MobileNavUserFallback />}>
                <MobileNavUserAsync />
              </Suspense>
            </MobileNav>
          </Suspense>
          <Link href="/" className="flex items-center">
            <span className="font-heading text-lg font-bold tracking-tight">
              Ahia
            </span>
          </Link>
        </div>

        {/* Center: Desktop nav */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Actions */}
        <Suspense fallback={<HeaderActionsFallback />}>
          <HeaderActions />
        </Suspense>
      </div>
    </header>
  );
};

const MobileNavUserAsync = async () => {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.user(),
    queryFn: async () => getUser(await getCookie()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MobileNavUserContent />
    </HydrationBoundary>
  );
};

const HeaderActions = async () => {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: queryKeys.user(),
    queryFn: async () => getUser(await getCookie()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex items-center gap-1">
        <Search />
        <UserMenu />
        <CartDrawer />
      </div>
    </HydrationBoundary>
  );
};

const HeaderActionsFallback = () => {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="size-8 rounded-lg" />
      ))}
    </div>
  );
};
