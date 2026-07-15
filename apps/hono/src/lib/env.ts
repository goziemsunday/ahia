import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    API_URL: z.url(),
    WEB_URL: z.url(),
    DOMAIN: z.string().optional(),
    DATABASE_URL: z.url(),
    SUPERADMIN_EMAIL: z.email(),
    BETTER_AUTH_SECRET: z.string().min(1),
    // Comma-separated list of allowed CORS origins (e.g., "http://localhost:3120,https://app.example.com")
    CORS_ORIGINS: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    RESEND_DOMAIN: z.string().min(1),
    CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1),
    CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1),
    CLOUDFLARE_R2_BUCKET_NAME: z.string().min(1),
    CLOUDFLARE_R2_PUBLIC_URL: z.url(),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export default env;
