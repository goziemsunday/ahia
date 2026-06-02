import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { getAdminMonthlyStats, getAdminStats } from "@/features/admin/queries";
import { getCookie } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

import { OverviewCharts } from "./overview-charts";
import { OverviewStats } from "./overview-stats";

const AdminOverviewPage = async () => {
  const queryClient = new QueryClient();

  const cookie = await getCookie();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.adminStats(),
      queryFn: async () => getAdminStats(cookie),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.adminMonthlyStats(),
      queryFn: async () => getAdminMonthlyStats(cookie),
    }),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="font-bricolage text-3xl font-bold tracking-tight">
          Overview
        </h1>
        <p className="text-muted-foreground">
          Welcome to the Ahia admin dashboard.
        </p>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <OverviewStats />
        <OverviewCharts />
      </HydrationBoundary>
    </div>
  );
};

export default AdminOverviewPage;
