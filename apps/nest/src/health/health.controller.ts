import { Controller, Get } from "@nestjs/common";

import { successResponse } from "../lib/utils";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return successResponse({ status: "OK" });
  }
}
