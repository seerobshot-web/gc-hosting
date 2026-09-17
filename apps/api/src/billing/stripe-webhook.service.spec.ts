import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type Stripe from "stripe";
import { prisma } from "@gch/database";
import { StripeService } from "./stripe.service";
import { StripeWebhookService } from "./stripe-webhook.service";

const rawBody = Buffer.from(JSON.stringify({ id: "evt_test", type: "ping" }));

/**
 * The signature check is the whole security boundary for this endpoint, so
 * these tests exercise it directly: a valid signature (constructEvent
 * returns an event) must be processed, while a missing header or a
 * constructEvent throw must surface as a 400 and never touch persistence.
 */
function serviceWith(constructEvent: Stripe.Webhooks["constructEvent"]) {
  const stripe = {
    client: { webhooks: { constructEvent } },
    webhookSecret: "whsec_test",
  } as unknown as StripeService;

  // audit/email are only reached by handled event types; the "unknown" event
  // used below short-circuits in dispatch(), so stubs are never invoked.
  const audit = { logAction: mock.fn(async () => undefined) } as never;
  const email = { send: mock.fn(async () => undefined) } as never;
  return new StripeWebhookService(stripe, audit, email);
}

describe("StripeWebhookService.handle", { concurrency: false }, () => {
  const originalCreate = prisma.webhookEvent.create;

  afterEach(() => {
    prisma.webhookEvent.create = originalCreate;
  });

  it("processes an event when the signature is valid", async () => {
    const constructEvent = mock.fn(
      (_body: unknown, _sig: unknown, _secret: unknown) =>
        ({ id: "evt_1", type: "unknown.event", data: { object: {} } }) as unknown as Stripe.Event,
    );
    const create = mock.fn(async () => ({ id: "evt_1", type: "unknown.event" }));
    prisma.webhookEvent.create = create as never;

    const service = serviceWith(constructEvent);
    const result = await service.handle(rawBody, "t=1,v1=validsig");

    assert.deepEqual(result, { received: true });
    assert.equal(constructEvent.mock.callCount(), 1);
    // constructEvent must be called over the exact raw bytes + secret.
    assert.equal(constructEvent.mock.calls[0]!.arguments[0], rawBody);
    assert.equal(constructEvent.mock.calls[0]!.arguments[2], "whsec_test");
    assert.equal(create.mock.callCount(), 1);
  });

  it("rejects with 400 when the signature is invalid", async () => {
    const constructEvent = mock.fn((): Stripe.Event => {
      throw new Error("No signatures found matching the expected signature");
    });
    const create = mock.fn(async () => ({ id: "x", type: "y" }));
    prisma.webhookEvent.create = create as never;

    const service = serviceWith(constructEvent);

    await assert.rejects(
      service.handle(rawBody, "t=1,v1=badsig"),
      (err: unknown) => err instanceof BadRequestException,
    );
    // The event must never be claimed/persisted when verification fails.
    assert.equal(create.mock.callCount(), 0);
  });

  it("rejects with 400 when the signature header is missing", async () => {
    const constructEvent = mock.fn(
      () => ({ id: "evt_2", type: "unknown.event" }) as unknown as Stripe.Event,
    );
    const service = serviceWith(constructEvent);

    await assert.rejects(
      service.handle(rawBody, undefined),
      (err: unknown) => err instanceof BadRequestException,
    );
    // Verification is never even attempted without a signature header.
    assert.equal(constructEvent.mock.callCount(), 0);
  });

  it("rejects with 400 when the raw body is missing", async () => {
    const constructEvent = mock.fn(
      () => ({ id: "evt_3", type: "unknown.event" }) as unknown as Stripe.Event,
    );
    const service = serviceWith(constructEvent);

    await assert.rejects(
      service.handle(undefined, "t=1,v1=sig"),
      (err: unknown) => err instanceof BadRequestException,
    );
    assert.equal(constructEvent.mock.callCount(), 0);
  });
});
