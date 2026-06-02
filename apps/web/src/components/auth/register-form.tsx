"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { cancelToastEl } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import env from "@/lib/env";

export const RegisterForm = () => {
  const [isGooglePending, setIsGooglePending] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">
          Sign up with your Google account to get started
        </p>
      </div>

      {/* Google */}
      <Button
        variant="outline"
        disabled={isGooglePending}
        className="h-11 w-full rounded-xl text-sm font-medium"
        onClick={() =>
          authClient.signIn.social(
            {
              provider: "google",
              callbackURL: env.NEXT_PUBLIC_WEB_URL,
            },
            {
              onRequest() {
                setIsGooglePending(true);
              },
              onSuccess: () => {
                setIsGooglePending(false);
              },
              onError(ctx) {
                setIsGooglePending(false);
                toast.error(ctx.error.message, cancelToastEl);
              },
            },
          )
        }
      >
        {isGooglePending ? (
          "Signing in..."
        ) : (
          <span className="flex items-center justify-center gap-2.5">
            <GoogleIcon />
            Continue with Google
          </span>
        )}
      </Button>

      {/* Terms */}
      <p className="mx-auto max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        By continuing, you agree to our{" "}
        <Link
          href="/terms"
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Privacy Policy
        </Link>
        .
      </p>

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-foreground transition-colors hover:text-primary"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
};
