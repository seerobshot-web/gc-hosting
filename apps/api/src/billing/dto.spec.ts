import assert from "node:assert/strict";
import { ValidationPipe } from "@nestjs/common";
import { describe, it } from "node:test";
import { CreateProductCheckoutSessionDto } from "./dto";

describe("CreateProductCheckoutSessionDto", () => {
  it("ignores browser-supplied external ids, prices, currencies, and destinations", async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const transformed = (await pipe.transform(
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
    )) as CreateProductCheckoutSessionDto & Record<string, unknown>;

    assert.deepEqual({ ...transformed }, {
      gchSlug: "web-hosting",
      billingCycle: "monthly",
    });
    assert.equal(transformed.externalProductId, undefined);
    assert.equal(transformed.externalProductKey, undefined);
    assert.equal(transformed.price, undefined);
    assert.equal(transformed.currency, undefined);
    assert.equal(transformed.approvedOrderDestination, undefined);
  });
});
