import { redirect } from "next/navigation";
import { ReactNode, Suspense } from "react";

import { getUser } from "@/features/user/queries";
import { getCookie } from "@/lib/auth";

const AuthGuard = async ({ children }: { children: ReactNode }) => {
  const user = await getUser(await getCookie());

  if (user) {
    redirect("/");
  }

  return <>{children}</>;
};

const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8">
      {/* Subtle background gradient to add a soft minimal touch without being distracting */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div
          className="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-muted to-muted/20 opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="z-10 flex w-full max-w-sm flex-col gap-6 sm:max-w-md">
        <Suspense fallback={null}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </div>
    </div>
  );
};

export default AuthLayout;
