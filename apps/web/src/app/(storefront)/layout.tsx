import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { ReactNode, Suspense } from "react";

import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import {
  getAllCategories,
  getFeaturedProduct,
  getLatestProducts,
  getTopCategories,
  getTrendingProducts,
} from "@/features/storefront/queries";
import { getCookie } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

const StorefrontDataProvider = async ({
  children,
}: {
  children: ReactNode;
}) => {
  const queryClient = new QueryClient();
  const cookie = await getCookie();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.featuredProduct(),
      queryFn: () => getFeaturedProduct(cookie),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.latestProducts(),
      queryFn: () => getLatestProducts(cookie),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.topCategories(),
      queryFn: () => getTopCategories(cookie),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.trendingProducts(),
      queryFn: () => getTrendingProducts(cookie),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.allCategories(),
      queryFn: () => getAllCategories(cookie),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
};

const StorefrontLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <SiteHeader />
      <main className="flex-1">
        <Suspense fallback={null}>
          <StorefrontDataProvider>{children}</StorefrontDataProvider>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
};

export default StorefrontLayout;
