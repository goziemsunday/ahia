import { db } from "@repo/db";
import type { User } from "@repo/db/validators/user.validator";

import { auth } from "@/lib/auth";
import { sendAccountCreatedEmail } from "@/lib/email";
import env from "@/lib/env";
import { generatePassword } from "@/lib/utils";
import { getUserByEmail } from "@/queries/user-queries";
import type { Role } from "@/types";

/** Creates an admin-managed user account when it does not already exist */
export const createUser = async (user: {
  name: string;
  email: string;
  role: Role;
}): Promise<User> => {
  // Check if the user with the email already exists
  const existingUser = await getUserByEmail(user.email);

  if (existingUser) {
    return existingUser;
  }

  // If the user does not exist, create a new one
  const password = generatePassword();
  const { user: newUser } = await auth.api.createUser({
    body: {
      email: user.email,
      name: user.name,
      role: user.role as
        | "admin"
        | "superadmin"
        | "userRole"
        | ("admin" | "superadmin" | "userRole")[]
        | undefined,
      password,
    },
  });

  // Send account created & verification emails
  await sendAccountCreatedEmail({
    to: user.email,
    role: user.role,
    name: user.name,
    email: user.email,
    password,
  });
  await auth.api.sendVerificationEmail({
    body: {
      email: user.email,
    },
  });

  return newUser as User;
};

/** Ensures a superadmin account exists on app startup */
export const createSuperadmin = async () => {
  const superadmin = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.role, "superadmin"),
  });

  if (!superadmin) {
    await createUser({
      name: "Super Admin",
      email: env.SUPERADMIN_EMAIL,
      role: "superadmin",
    });
  }
};
