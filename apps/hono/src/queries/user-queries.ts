import { db } from "@repo/db";

/** Fetches a user record by id */
export const getUserById = async (userId: string) => {
  const user = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.id, userId),
  });

  return user || null;
};

/** Fetches a user record by email address */
export const getUserByEmail = async (email: string) => {
  const user = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.email, email),
  });

  return user || null;
};

/** Fetches a session record by session token */
export const getSessionByToken = async (sessionToken: string) => {
  const session = await db.query.session.findFirst({
    where: (session, { eq }) => eq(session.token, sessionToken),
  });

  return session || null;
};
