import type { NotFoundHandler } from "hono";

import HttpStatusCodes from "@/lib/http-status-codes";
import { errorResponse } from "@/lib/utils";

const notFoundRoute: NotFoundHandler = (c) => {
  return c.json(
    errorResponse("NOT_FOUND", `Route not found - '${c.req.path}'`),
    HttpStatusCodes.NOT_FOUND,
  );
};

export default notFoundRoute;
