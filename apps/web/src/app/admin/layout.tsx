import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ReactNode, Suspense } from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  defaultAdminCategoriesListParams,
  defaultAdminProductsListParams,
  defaultAdminOrdersListParams,
  defaultAdminUsersListParams,
  getAdminCategories,
  getAdminOrders,
  getAdminProducts,
  getAdminUsers,
} from "@/features/admin/queries";
import { getUser } from "@/features/user/queries";
import { queryKeys } from "@/lib/query-keys";

const AdminAuthWrapper = async ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient();
  const cookie = (await headers()).get("cookie") ?? undefined;

  const user = await queryClient.fetchQuery({
    queryKey: queryKeys.user(),
    queryFn: async () => getUser(cookie),
  });

  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    redirect("/");
  }

  // Users
  await queryClient.prefetchQuery({
    queryKey: queryKeys.adminUsers(defaultAdminUsersListParams),
    queryFn: async () => getAdminUsers(defaultAdminUsersListParams, cookie),
  });

  // Categories
  await queryClient.prefetchQuery({
    queryKey: queryKeys.adminCategories(defaultAdminCategoriesListParams),
    queryFn: async () =>
      getAdminCategories(defaultAdminCategoriesListParams, cookie),
  });

  // Products
  await queryClient.prefetchQuery({
    queryKey: queryKeys.adminProducts(defaultAdminProductsListParams),
    queryFn: async () =>
      getAdminProducts(defaultAdminProductsListParams, cookie),
  });

  // Orders
  await queryClient.prefetchQuery({
    queryKey: queryKeys.adminOrders(defaultAdminOrdersListParams),
    queryFn: async () => getAdminOrders(defaultAdminOrdersListParams, cookie),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminSidebar />
      <SidebarInset>
        <header className="sticky top-0 big-container flex items-center gap-2 px-2 py-2 md:hidden">
          <SidebarTrigger size={"icon-lg"} />
        </header>
        <div className="big-container flex w-full flex-1 flex-col p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </SidebarInset>
    </HydrationBoundary>
  );
};

const AdminLayout = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  return (
    <SidebarProvider>
      <Suspense fallback={null}>
        <AdminAuthWrapper>{children}</AdminAuthWrapper>
      </Suspense>
    </SidebarProvider>
  );
};

export default AdminLayout;
