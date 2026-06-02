import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { UserSettings } from "@/components/storefront/user-settings";
import { Skeleton } from "@/components/ui/skeleton";
import { getUser } from "@/features/user/queries";
import { getCookie } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account settings and preferences.",
};

const SettingsPage = () => {
  return (
    <div className="small-container mx-auto px-4 py-12 md:py-20">
      <div className="flex flex-col gap-10">
        {/* Page header */}
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and preferences.
          </p>
        </div>

        <Suspense fallback={<SettingsContentFallback />}>
          <SettingsContent />
        </Suspense>
      </div>
    </div>
  );
};

const SettingsContent = async () => {
  const queryClient = new QueryClient();
  const cookie = await getCookie();

  const user = await queryClient.fetchQuery({
    queryKey: queryKeys.user(),
    queryFn: async () => getUser(cookie),
  });

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserSettings />
    </HydrationBoundary>
  );
};

const SettingsContentFallback = () => {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-full md:w-1/2" />
        <Skeleton className="h-101.25 w-full" />
      </div>
    </div>
  );
};

export default SettingsPage;
