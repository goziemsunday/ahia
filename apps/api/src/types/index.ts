import { db } from "@repo/db";

import { auth } from "@/lib/auth";

export type AppEnv = {
  Variables: {
    user: typeof auth.$Infer.Session.user;
    sessionToken: string;
  };
};

export type Role = "user" | "admin" | "superadmin";

/**
 * Union type representing either the global `db` instance or a Drizzle
 * transaction object. The relational query builder (`db.query.*`) works
 * identically on both, so we accept the union and let the caller decide
 * whether to read inside a transaction (atomicity guarantee) or outside
 * (no transaction overhead).
 */
export type DbOrTx =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];
