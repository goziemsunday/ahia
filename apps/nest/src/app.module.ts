import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";

import { HealthModule } from "./health/health.module";
import { auth } from "./lib/auth";

@Module({
  imports: [HealthModule, AuthModule.forRoot({ auth })],
})
export class AppModule {}
