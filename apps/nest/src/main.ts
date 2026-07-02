import { NestFactory } from "@nestjs/core";
import "dotenv/config";

import { AppModule } from "./app.module";
import env from "./lib/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
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
