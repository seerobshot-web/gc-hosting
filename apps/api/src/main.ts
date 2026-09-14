import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

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
