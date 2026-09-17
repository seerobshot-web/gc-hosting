import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type Stripe from "stripe";
import { prisma } from "@gch/database";
import { ORDER_PAID } from "./billing.events";
import { StripeService } from "./stripe.service";
import { StripeWebhookService } from "./stripe-webhook.service";

const rawBody = Buffer.from(JSON.stringify({ id: "evt_test", type: "ping" }));

function serviceWith(
  constructEvent: Stripe.Webhooks["constructEvent"],
  emit: (name: string, payload: unknown) => boolean = () => true,
) {
  const stripe = {
    client: { webhooks: { constructEvent } },
    webhookSecret: "whsec_test",
  } as unknown as StripeService;

  const audit = { logAction: mock.fn(async () => undefined) } as never;
  const email = { send: mock.fn(async () => undefined) } as never;
  const events = { emit: mock.fn(emit) } as unknown as EventEmitter2;
  return {
    service: new StripeWebhookService(stripe, audit, email, events),
    emit: events.emit as unknown as ReturnType<typeof mock.fn>,
  };
}

describe("StripeWebhookService.handle — signature boundary", { concurrency: false }, () => {
  const originalFind = prisma.idempotencyRecord.findUnique;
  const originalCreate = prisma.idempotencyRecord.create;

  beforeEach(() => {
    prisma.idempotencyRecord.findUnique = mock.fn(async () => null) as never;
    prisma.idempotencyRecord.create = mock.fn(async () => ({})) as never;
  });
  afterEach(() => {
    prisma.idempotencyRecord.findUnique = originalFind;
    prisma.idempotencyRecord.create = originalCreate;
  });

  it("processes an event when the signature is valid", async () => {
    const constructEvent = mock.fn(
      () =>
        ({ id: "evt_1", type: "unknown.event", data: { object: {} } }) as unknown as Stripe.Event,
    );
    const { service } = serviceWith(constructEvent);
    const result = await service.handle(rawBody, "t=1,v1=validsig");

    assert.deepEqual(result, { received: true, handled: false, type: "unknown.event" });
    assert.equal(constructEvent.mock.callCount(), 1);
    assert.equal((constructEvent.mock.calls[0]!.arguments as unknown as unknown[])[0], rawBody);
    assert.equal((constructEvent.mock.calls[0]!.arguments as unknown as unknown[])[2], "whsec_test");
  });

  it("rejects with 400 when the signature is invalid", async () => {
    const constructEvent = mock.fn((): Stripe.Event => {
      throw new Error("No signatures found matching the expected signature");
    });
    const find = mock.fn(async () => null);
    prisma.idempotencyRecord.findUnique = find as never;
    const { service } = serviceWith(constructEvent);

    await assert.rejects(
      service.handle(rawBody, "t=1,v1=badsig"),
      (err: unknown) => err instanceof BadRequestException,
    );
    // Verification fails before the idempotency store is ever consulted.
    assert.equal(find.mock.callCount(), 0);
  });

  it("rejects with 400 when the signature header is missing", async () => {
    const constructEvent = mock.fn(() => ({ id: "evt_2" }) as unknown as Stripe.Event);
    const { service } = serviceWith(constructEvent);
    await assert.rejects(
      service.handle(rawBody, undefined),
      (err: unknown) => err instanceof BadRequestException,
    );
    assert.equal(constructEvent.mock.callCount(), 0);
  });

  it("rejects with 400 when the raw body is missing", async () => {
    const constructEvent = mock.fn(() => ({ id: "evt_3" }) as unknown as Stripe.Event);
    const { service } = serviceWith(constructEvent);
    await assert.rejects(
      service.handle(undefined, "t=1,v1=sig"),
      (err: unknown) => err instanceof BadRequestException,
    );
    assert.equal(constructEvent.mock.callCount(), 0);
  });
});

describe("StripeWebhookService.handle — idempotent replay", { concurrency: false }, () => {
  // Snapshot every prisma method the checkout handler touches so we can
  // restore them and count how often the real side effects run.
  const originals = {
    idemFind: prisma.idempotencyRecord.findUnique,
    idemCreate: prisma.idempotencyRecord.create,
    subUpsert: prisma.subscription.upsert,
    orderFindUnique: prisma.order.findUnique,
    orderFindFirst: prisma.order.findFirst,
    orderCreate: prisma.order.create,
    orderUpdate: prisma.order.update,
  };
  let store: Map<string, { key: string; result: unknown }>;
  let subUpsert: ReturnType<typeof mock.fn>;
  let orderUpdate: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    store = new Map();
    // Persistent idempotency store shared across the two deliveries.
    prisma.idempotencyRecord.findUnique = mock.fn(
      async ({ where: { key } }: { where: { key: string } }) => store.get(key) ?? null,
    ) as never;
    prisma.idempotencyRecord.create = mock.fn(
      async ({ data }: { data: { key: string; result: unknown } }) => {
        if (store.has(data.key)) {
          const e = new Error("Unique constraint") as Error & { code: string };
          e.code = "P2002";
          // Match Prisma's known-request-error shape enough for instanceof? The
          // service's P2002 branch checks instanceof PrismaClientKnownRequestError;
          // in this sequential test the branch is never hit, so a plain throw
          // would be fine — but we never double-create here.
          throw e;
        }
        store.set(data.key, { key: data.key, result: data.result });
        return store.get(data.key);
      },
    ) as never;

    subUpsert = mock.fn(async () => ({ orgId: "org_1" }));
    prisma.subscription.upsert = subUpsert as never;
    prisma.order.findUnique = mock.fn(async () => null) as never;
    // No pre-existing PENDING order -> handler creates one.
    prisma.order.findFirst = mock.fn(async () => null) as never;
    prisma.order.create = mock.fn(async () => ({
      id: "ord_1",
      orgId: "org_1",
      planId: "plan_1",
      status: "PENDING",
    })) as never;
    orderUpdate = mock.fn(async () => ({ id: "ord_1", status: "PAID" }));
    prisma.order.update = orderUpdate as never;
  });

  afterEach(() => {
    prisma.idempotencyRecord.findUnique = originals.idemFind;
    prisma.idempotencyRecord.create = originals.idemCreate;
    prisma.subscription.upsert = originals.subUpsert;
    prisma.order.findUnique = originals.orderFindUnique;
    prisma.order.findFirst = originals.orderFindFirst;
    prisma.order.create = originals.orderCreate;
    prisma.order.update = originals.orderUpdate;
  });

  function checkoutEvent(): Stripe.Event {
    return {
      id: "evt_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          mode: "subscription",
          metadata: { orgId: "org_1", planId: "plan_1" },
          customer: "cus_1",
          subscription: "sub_1",
          payment_intent: "pi_1",
          client_reference_id: "org_1",
        },
      },
    } as unknown as Stripe.Event;
  }

  it("processes the first delivery: PENDING->PAID, audits, emits order.paid", async () => {
    const constructEvent = mock.fn(() => checkoutEvent());
    const { service, emit } = serviceWith(constructEvent);

    const result = (await service.handle(rawBody, "sig")) as Record<string, unknown>;

    assert.equal(result.orderId, "ord_1");
    assert.equal(result.orderStatus, "PAID");
    assert.equal(subUpsert.mock.callCount(), 1);
    assert.equal(orderUpdate.mock.callCount(), 1);
    // Update moved the order to PAID with the payment id.
    const updateArg = (orderUpdate.mock.calls[0]!.arguments as unknown as unknown[])[0] as {
      data: { status: string; stripePaymentId: string };
    };
    assert.equal(updateArg.data.status, "PAID");
    assert.equal(updateArg.data.stripePaymentId, "pi_1");
    // Exactly one order.paid domain event.
    assert.equal(emit.mock.callCount(), 1);
    assert.equal((emit.mock.calls[0]!.arguments as unknown as unknown[])[0], ORDER_PAID);
  });

  it("replays the second delivery of the same event id with no duplicate side effects", async () => {
    const constructEvent = mock.fn(() => checkoutEvent());
    const { service, emit } = serviceWith(constructEvent);

    const first = await service.handle(rawBody, "sig");
    const second = await service.handle(rawBody, "sig");

    // Same result returned both times...
    assert.deepEqual(second, first);
    // ...but the state transition and its side effects ran exactly once.
    assert.equal(subUpsert.mock.callCount(), 1);
    assert.equal(orderUpdate.mock.callCount(), 1);
    assert.equal(emit.mock.callCount(), 1);
  });
});
