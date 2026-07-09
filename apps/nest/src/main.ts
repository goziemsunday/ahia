import { NestFactory } from "@nestjs/core";
import "dotenv/config";

import { AppModule } from "./app.module";
import env from "./lib/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // We're using the `@thallesp/nestjs-better-auth` package which disables
    // NestJS's built-in body parser, therefore the `rawBody: true` option in
    // `NestFactory.create()` has no effect. To regain access to req.rawBody
    // (eg. for webhook signature verification), we set the `bodyParser.rawBody`
    // in `AuthModule.forRoot()` in `app.module.ts` to true.
    bodyParser: false,
  });

  const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
    : env.WEB_URL;

  app.setGlobalPrefix("api");
  app.enableCors({ origin: corsOrigins, credentials: true });

  await app.listen(5000);
}
void bootstrap();
