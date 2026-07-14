import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import "dotenv/config";

import { AppModule } from "./app.module";
import env from "./lib/env";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
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

  app.set("trust proxy", "loopback");
  app.setGlobalPrefix("api");
  app.enableCors({ origin: corsOrigins, credentials: true });

  const config = new DocumentBuilder()
    .setTitle("Ahia API")
    .setDescription("The API for Ahia, an eCommerce site.")
    .setVersion("0.0.1")
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("", app, documentFactory, {
    jsonDocumentUrl: "api/doc",
    ui: false,
  });

  app.use(
    "/api/reference",
    apiReference({
      url: "/api/doc",
      authentication: {
        preferredSecurityScheme: "bearerAuth",
        securitySchemes: {
          bearerAuth: { token: "" },
        },
      },
      persistAuth: true,
      pageTitle: "Ahia API",
      theme: "saturn",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "axios",
      },
    }),
  );

  await app.listen(5000);
}
void bootstrap();
