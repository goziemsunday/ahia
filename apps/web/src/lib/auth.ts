import { headers } from "next/headers";

/**
 * Extract the session cookie from the request headers inside a Server
 * Action. Returns the `{ cookie: string }` header object that can be
 * spread into `fetch` options to forward the user's session to the API.
 */
export const getAuthHeaders = async (): Promise<{ cookie: string }> => {
  const headersList = await headers();
  return { cookie: headersList.get("cookie") ?? "" };
};

/**
 * Extract just the cookie value (as `string | undefined`) from the
 * request headers inside a Server Component or Server Action. Used
 * when query functions expect a plain cookie string rather than a
 * headers object.
 */
export const getCookie = async (): Promise<string | undefined> => {
  const headersList = await headers();
  return headersList.get("cookie") ?? undefined;
};
