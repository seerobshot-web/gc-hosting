import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.schema";

/**
 * Parses ALLOWED_ORIGINS (comma-separated) into an explicit allowlist.
 * CORS is NEVER opened with origin:true or "*" in any environment — a
 * missing/empty allowlist yields an empty list (all cross-origin denied).
 */
function parseAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

async function bootstrap() {
  // Fail fast: validate the environment before wiring anything up. Only the
  // failing variable NAMES are logged — never their values.
  const env = validateEnv();
  if (!env.success) {
    const logger = new Logger("Bootstrap");
    logger.error(`Environment validation failed. Fix these variables: ${env.invalidVars.join(", ")}`);
    process.exit(1);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    // Stripe's webhook signature is computed over the exact bytes sent;
    // rawBody keeps them alongside the parsed JSON (see StripeWebhookController).
    { rawBody: true },
  );

  const allowedOrigins = parseAllowedOrigins();
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle("GCH Operations & GloryLink Core API")
    .setDescription(
      "Orgs, clients, GLinks, audit log, and ResellPortal provisioning — the surface the future GCH Aleph agent reads/writes against.",
    )
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`GCH API listening on :${port} — docs at /docs`);
}

bootstrap();
