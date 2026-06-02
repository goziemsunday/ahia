"use client";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { GoogleIcon } from "@/components/ui/google-icon";
import { Input } from "@/components/ui/input";
import { cancelToastEl } from "@/components/ui/sonner";
import { authClient } from "@/lib/auth-client";
import env from "@/lib/env";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";

export const SignInForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const [isGooglePending, setIsGooglePending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectParam = searchParams.get("redirect");
  const redirectPath =
    redirectParam &&
    redirectParam.startsWith("/") &&
    !redirectParam.startsWith("//")
      ? redirectParam
      : "/";
  const callbackURL = `${env.NEXT_PUBLIC_WEB_URL}${redirectPath}`;

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
          callbackURL,
        },
        {
          onRequest() {
            setIsPending(true);
          },
          onSuccess: () => {
            setIsPending(false);
            toast.success("Signed in successfully", cancelToastEl);
            form.reset();
            router.push(redirectPath);
            router.refresh();
          },
          onError(ctx) {
            setIsPending(false);
            toast.error(
              ctx.error.message || "An error occurred while signing in",
              cancelToastEl,
            );
          },
          onSettled() {
            setIsPending(false);
          },
        },
      );
    },
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await form.handleSubmit();
        }}
        className="flex flex-col gap-5"
      >
        <FieldGroup>
          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                const res = z
                  .email("Please enter a valid email address")
                  .safeParse(value);
                return res.success ? undefined : res.error.issues[0]?.message;
              },
            }}
          >
            {(field) => (
              <Field
                data-invalid={
                  field.state.meta.errors.length > 0 ? true : undefined
                }
              >
                <FieldLabel
                  htmlFor={field.name}
                  className="text-sm font-medium"
                >
                  Email
                </FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="h-11 rounded-xl"
                  value={field.state.value}
                  disabled={isPending || isGooglePending}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                )}
              </Field>
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "Password is required";
                if (value.length < 8)
                  return "Password must be at least 8 characters";
                return undefined;
              },
            }}
          >
            {(field) => (
              <Field
                data-invalid={
                  field.state.meta.errors.length > 0 ? true : undefined
                }
              >
                <FieldContent className="flex-row items-center justify-between">
                  <FieldLabel
                    htmlFor={field.name}
                    className="text-sm font-medium"
                  >
                    Password
                  </FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </FieldContent>
                <InputGroup className="h-11 rounded-xl">
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    type={showPassword ? "text" : "password"}
                    value={field.state.value}
                    disabled={isPending || isGooglePending}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size={"icon-sm"}
                      className={"h-10"}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      <HugeiconsIcon
                        icon={showPassword ? ViewOffIcon : ViewIcon}
                        className="size-5"
                      />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {field.state.meta.errors.length > 0 && (
                  <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                )}
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={
                !canSubmit || isSubmitting || isPending || isGooglePending
              }
              className="mt-1 h-11 w-full rounded-xl text-sm font-semibold"
            >
              {isSubmitting || isPending ? "Signing in..." : "Sign in"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      {/* Divider */}
      <div className="relative text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border/60">
        <span className="relative z-10 bg-background px-3 text-muted-foreground">
          or
        </span>
      </div>

      {/* Google */}
      <Button
        variant="outline"
        disabled={isGooglePending || isPending}
        className="h-11 w-full rounded-xl text-sm font-medium"
        onClick={() =>
          authClient.signIn.social(
            {
              provider: "google",
              callbackURL,
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

      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground transition-colors hover:text-primary"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
};
