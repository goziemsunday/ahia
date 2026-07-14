import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { ApiSuccessRes } from "../common/decorators/api-success-res.decorator";
import { successResponse } from "../lib/utils";
import { HealthDto } from "./health.dto";

@ApiTags("Health")
@AllowAnonymous()
@Controller("health")
export class HealthController {
  @Get()
  @ApiOperation({ description: "Check API health status" })
  @ApiSuccessRes({ model: HealthDto, description: "Health check" })
  health() {
    return successResponse({ status: "OK" });
  }
}
