import assert from "node:assert/strict";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { describe, it } from "node:test";
import { CreateProductCheckoutSessionDto } from "./dto";

describe("CreateProductCheckoutSessionDto", () => {
  it("rejects browser-supplied external ids, prices, currencies, and destinations", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await assert.rejects(
      pipe.transform(
      {
        gchSlug: "web-hosting",
        billingCycle: "monthly",
        externalProductId: "browser-controlled-id",
        externalProductKey: "browser-controlled-key",
        price: "1",
        currency: "usd",
        approvedOrderDestination: "https://evil.example.test",
      },
      {
        type: "body",
        metatype: CreateProductCheckoutSessionDto,
      },
    ),
      (error: unknown) => error instanceof BadRequestException,
    );
  });
});
