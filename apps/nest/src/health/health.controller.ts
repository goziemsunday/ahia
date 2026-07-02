import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { successResponse } from "../lib/utils";

@AllowAnonymous()
@Controller("health")
export class HealthController {
  @Get()
  health() {
    return successResponse({ status: "OK" });
  }
}
