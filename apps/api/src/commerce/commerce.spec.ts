import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it, mock, afterEach } from "node:test";
import { ConfigService } from "@nestjs/config";
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { prisma, Prisma } from "@gch/database";
import Stripe from "stripe";
import { CommerceService } from "./commerce.service";
import { CommerceStripeAdapter } from "./commerce-stripe.adapter";
import { DeliveryAdapter } from "./delivery.adapter";
import type { EmailService } from "../email/email.service";

function fixture(overrides: Record<string, string> = {}) {
  const config = new ConfigService({
    COMMERCE_ENABLED: "true",
    COMMERCE_ENABLED_DEALS: "brand-identity-development",
    COMMERCE_POLICIES_APPROVED: "true",
    COMMERCE_STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    COMMERCE_INTAKE_KEY: "11".repeat(32),
    COMMERCE_TAX_MODE: "none",
    COMMERCE_OPS_EMAIL: "ops@example.invalid",
    COMMERCE_OPS_USER_IDS: "ops-fixture",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    ...overrides,
  });
  const stripe = {
    verify: mock.fn(() => event()),
    paid: mock.fn(async () => true),
    create: mock.fn(),
  };
  const delivery = {
    guide: mock.fn(async () => Buffer.from("%PDF-fixture")),
    link: mock.fn(() => "https://example.invalid/guide"),
    valid: mock.fn(() => true),
  };
  const email = { isConfigured: true, sendRequired: mock.fn(async () => undefined) };
  const service = new CommerceService(
    config,
    stripe as unknown as CommerceStripeAdapter,
    delivery as unknown as DeliveryAdapter,
    email as unknown as EmailService,
  );
  return { service, stripe, delivery, email };
}
const originalTransaction = prisma.$transaction;
const originalEventFind = prisma.commerceStripeEvent.findUnique;
afterEach(() => {
  prisma.$transaction = originalTransaction;
  prisma.commerceStripeEvent.findUnique = originalEventFind;
  mock.restoreAll();
});
function event(status = "paid", type = "checkout.session.completed") {
  return {
    id: "evt_test",
    type,
    livemode: false,
    data: {
      object: {
        id: "cs_test",
        mode: "payment",
        livemode: false,
        payment_status: status,
        amount_total: 17500,
        currency: "usd",
        client_reference_id: "order1",
        payment_intent: "pi_test",
        metadata: {
          order_id: "order1",
          deal_id: "brand-identity-development",
          catalog_version: "2026-10-06.1",
        },
      },
    },
  };
}
function transactionFixture() {
  const order = {
    id: "order1",
    status: "CREATED",
    stripeSessionId: "cs_test",
    dealId: "brand-identity-development",
    catalogVersion: "2026-10-06.1",
    amountCents: 17500,
    currency: "usd",
  };
  const tx = {
    commerceStripeEvent: { create: mock.fn(async () => ({})) },
    commerceOrder: {
      findUnique: mock.fn(async () => order),
      updateMany: mock.fn(async (input: unknown) => {
        void input;
        return { count: 1 };
      }),
      update: mock.fn(async () => ({})),
    },
    commerceJob: { upsert: mock.fn(async () => ({})) },
    auditLog: { create: mock.fn(async () => ({})) },
  };
  prisma.$transaction = mock.fn(async (run: (db: unknown) => unknown) => run(tx)) as never;
  return { tx, order };
}
describe("prepaid webhook authority boundary", { concurrency: false }, () => {
  it("missing/invalid signature cannot touch storage", async () => {
    const { service, stripe } = fixture();
    stripe.verify.mock.mockImplementation(() => {
      throw new Error("credential-rich upstream exception");
    });
    const transact = mock.fn();
    prisma.$transaction = transact as never;
    await assert.rejects(service.webhook(undefined, "signature"), BadRequestException);
    await assert.rejects(
      service.webhook(Buffer.from("body"), "signature"),
      /invalid_stripe_signature/,
    );
    assert.equal(transact.mock.callCount(), 0);
  });
  it("ACH completed but unpaid records the event without granting payment or a job", async () => {
    const { service, stripe } = fixture();
    stripe.verify.mock.mockImplementation(() => event("unpaid"));
    const { tx } = transactionFixture();
    await service.webhook(Buffer.from("body"), "sig");
    assert.equal(tx.commerceStripeEvent.create.mock.callCount(), 1);
    assert.equal(tx.commerceOrder.updateMany.mock.callCount(), 0);
    assert.equal(tx.commerceJob.upsert.mock.callCount(), 0);
  });
  it("paid async success commits transition, audit and durable job together", async () => {
    const { service, stripe } = fixture();
    stripe.verify.mock.mockImplementation(() =>
      event("paid", "checkout.session.async_payment_succeeded"),
    );
    const { tx } = transactionFixture();
    await service.webhook(Buffer.from("body"), "sig");
    assert.equal(tx.commerceOrder.updateMany.mock.callCount(), 1);
    assert.equal(tx.auditLog.create.mock.callCount(), 1);
    assert.equal(tx.commerceJob.upsert.mock.callCount(), 1);
    assert.equal(stripe.create.mock.callCount(), 0);
  });
  it("price or reference mismatch holds rather than provisions", async () => {
    const { service, stripe } = fixture();
    const e = event();
    e.data.object.amount_total = 1;
    stripe.verify.mock.mockImplementation(() => e);
    const { tx } = transactionFixture();
    await service.webhook(Buffer.from("body"), "sig");
    const arg = tx.commerceOrder.updateMany.mock.calls[0]!.arguments[0] as unknown as {
      data: { status: string };
    };
    assert.equal(arg.data.status, "HELD");
  });
  it("live events are rejected before storage", async () => {
    const { service, stripe } = fixture();
    const e = event();
    e.livemode = true;
    stripe.verify.mock.mockImplementation(() => e);
    const { tx } = transactionFixture();
    await assert.rejects(service.webhook(Buffer.from("body"), "sig"), /live_events_disabled/);
    assert.equal(tx.commerceStripeEvent.create.mock.callCount(), 0);
  });
  it("a replay claim conflict returns before executing transitions", async () => {
    const { service, stripe } = fixture();
    stripe.verify.mock.mockImplementation(() => event());
    const { tx } = transactionFixture();
    tx.commerceStripeEvent.create.mock.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "5.22.0",
      });
    });
    prisma.commerceStripeEvent.findUnique = mock.fn(async () => ({ id: "evt_test" })) as never;
    assert.deepEqual(await service.webhook(Buffer.from("body"), "sig"), {
      received: true,
      replay: true,
    });
    assert.equal(tx.commerceOrder.updateMany.mock.callCount(), 0);
  });
  it("kill switch rejects checkout before calling Stripe or loading a guide", async () => {
    const { service, stripe, delivery } = fixture({ COMMERCE_ENABLED: "false" });
    await assert.rejects(
      service.checkout("user1", "brand-identity-development", "requestkey1234567"),
      ServiceUnavailableException,
    );
    assert.equal(stripe.create.mock.callCount(), 0);
    assert.equal(delivery.guide.mock.callCount(), 0);
  });
  it("an empty operator allowlist disables catalog availability and checkout", async () => {
    const { service, stripe, delivery } = fixture({ COMMERCE_OPS_USER_IDS: " , " });
    assert.equal(
      (await service.catalog()).items.some((item) => item.available),
      false,
    );
    await assert.rejects(
      service.checkout("user1", "brand-identity-development", "requestkey1234567"),
      ServiceUnavailableException,
    );
    assert.equal(stripe.create.mock.callCount(), 0);
    assert.equal(delivery.guide.mock.callCount(), 0);
  });
  it("a nonexistent operator blocks payment before any checkout side effects", async () => {
    const { service, stripe, delivery } = fixture();
    const original = prisma.user.findFirst;
    try {
      prisma.user.findFirst = mock.fn(async () => null) as never;
      assert.equal(
        (await service.catalog()).items.some((item) => item.available),
        false,
      );
      await assert.rejects(
        service.checkout("user1", "brand-identity-development", "requestkey1234567"),
        ServiceUnavailableException,
      );
      assert.equal(stripe.create.mock.callCount(), 0);
      assert.equal(delivery.guide.mock.callCount(), 0);
    } finally {
      prisma.user.findFirst = original;
    }
  });
});
describe("private delivery tokens", () => {
  it("the kill switch revokes an otherwise valid guide before reading its PDF", async () => {
    const { service, delivery } = fixture({ COMMERCE_ENABLED: "false" });
    const original = prisma.commerceOrder.findUnique;
    try {
      prisma.commerceOrder.findUnique = mock.fn(async () => ({
        id: "order1",
        status: "ACTIVE",
        dealId: "brand-identity-development",
      })) as never;
      await assert.rejects(
        service.guide("order1", Math.floor(Date.now() / 1000) + 3600, "valid"),
        NotFoundException,
      );
      assert.equal(delivery.guide.mock.callCount(), 0);
    } finally {
      prisma.commerceOrder.findUnique = original;
    }
  });
  it("rejects altered, expired, malformed and cross-order tokens", () => {
    const adapter = new DeliveryAdapter(
      new ConfigService({
        COMMERCE_DELIVERY_SECRET: "test-secret-with-more-than-32-characters",
        COMMERCE_API_ORIGIN: "https://ops.example.invalid",
      }),
    );
    const link = new URL(adapter.link("order1", "brand-identity-development"));
    const expires = Number(link.searchParams.get("expires"));
    const sig = link.searchParams.get("signature")!;
    assert.equal(adapter.valid("order1", "brand-identity-development", expires, sig), true);
    assert.equal(adapter.valid("order2", "brand-identity-development", expires, sig), false);
    assert.equal(adapter.valid("order1", "brand-identity-development", expires - 3601, sig), false);
    assert.equal(adapter.valid("order1", "brand-identity-development", expires, "short"), false);
  });
  it("live Stripe keys cannot create a prepaid checkout", async () => {
    const adapter = new CommerceStripeAdapter(
      new ConfigService({ STRIPE_SECRET_KEY: "sk_live_fixture" }),
    );
    await assert.rejects(adapter.paid("cs_fixture"), /commerce_requires_stripe_test_key/);
  });
  it("verifies real Stripe SDK signatures locally without network", () => {
    const secret = "whsec_fixture";
    const body = JSON.stringify(event());
    const stripe = new Stripe("sk_test_fixture");
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    const adapter = new CommerceStripeAdapter(
      new ConfigService({
        STRIPE_SECRET_KEY: "sk_test_fixture",
        COMMERCE_STRIPE_WEBHOOK_SECRET: secret,
      }),
    );
    assert.equal(adapter.verify(Buffer.from(body), signature).id, "evt_test");
    assert.throws(() => adapter.verify(Buffer.from(body + " "), signature));
  });
});

describe("encrypted brand intake", () => {
  it("encrypts at rest, binds ownership and rejects tampering", async () => {
    const { encryptIntake, decryptIntake } = await import("./intake-crypto");
    const bytes = Buffer.from("%PDF-test intake content");
    const key = "11".repeat(32);
    const first = encryptIntake(bytes.toString("base64"), "order1:user1", key);
    const second = encryptIntake(bytes.toString("base64"), "order1:user1", key);
    assert.equal(first.mime, "application/pdf");
    assert.notDeepEqual(first.encrypted, second.encrypted);
    assert.equal(first.encrypted.includes(bytes), false);
    assert.deepEqual(decryptIntake(first.encrypted, "order1:user1", key), bytes);
    assert.throws(() => decryptIntake(first.encrypted, "order1:user2", key));
    const modified = Buffer.from(first.encrypted);
    modified[modified.length - 1]! ^= 1;
    assert.throws(() => decryptIntake(modified, "order1:user1", key));
    assert.throws(
      () =>
        encryptIntake(Buffer.from("<script>bad</script>").toString("base64"), "order1:user1", key),
      /intake_requires_pdf_or_png/,
    );
    assert.throws(
      () => encryptIntake(bytes.toString("base64"), "order1:user1", undefined),
      /intake_key_missing/,
    );
  });
});

describe("durable hold and ownership", { concurrency: false }, () => {
  it("holds unresolved RP jobs and alerts without creating another charge", async () => {
    const { service, stripe, email } = fixture();
    const { tx, order } = transactionFixture();
    order.status = "PAID";
    order.dealId = "seed-standard";
    const find = prisma.commerceJob.findMany;
    const update = prisma.commerceJob.update;
    try {
      prisma.commerceJob.findMany = mock.fn(async () => [
        { orderId: order.id, state: "PENDING", alertSentAt: null, order },
      ]) as never;
      prisma.commerceJob.update = mock.fn(async () => ({})) as never;
      await service.process();
      const input = tx.commerceOrder.updateMany.mock.calls[0]!.arguments[0] as {
        data: { status: string };
      };
      assert.equal(input.data.status, "HELD");
      assert.equal(email.sendRequired.mock.callCount(), 1);
      assert.equal(stripe.create.mock.callCount(), 0);
    } finally {
      prisma.commerceJob.findMany = find;
      prisma.commerceJob.update = update;
    }
  });
  it("customer listing always binds the authenticated user, never a supplied email", async () => {
    const { service } = fixture();
    const original = prisma.commerceOrder.findMany;
    const read = mock.fn(async (input: unknown) => {
      void input;
      return [];
    });
    try {
      prisma.commerceOrder.findMany = read as never;
      await service.list("user1");
      const input = read.mock.calls[0]!.arguments[0] as {
        where: { userId: string };
        select: Record<string, boolean>;
      };
      assert.deepEqual(input.where, { userId: "user1" });
      assert.equal(input.select.brandIntakeEncrypted, undefined);
      assert.equal(input.select.customerEmail, undefined);
    } finally {
      prisma.commerceOrder.findMany = original;
    }
  });
  it("refunds hold an active order and enqueue review", async () => {
    const { service, stripe } = fixture();
    stripe.verify.mock.mockImplementation(
      () =>
        ({
          id: "evt_refund",
          type: "charge.refunded",
          livemode: false,
          data: { object: { payment_intent: "pi_test" } },
        }) as never,
    );
    const { tx, order } = transactionFixture();
    order.status = "ACTIVE";
    await service.webhook(Buffer.from("signed-body"), "sig");
    const input = tx.commerceOrder.updateMany.mock.calls[0]!.arguments[0] as {
      data: { status: string };
    };
    assert.equal(input.data.status, "HELD");
    assert.equal(tx.commerceJob.upsert.mock.callCount(), 1);
    assert.equal(stripe.create.mock.callCount(), 0);
  });
  it("fresh Stripe verification refuses refunded or disputed payments", async () => {
    const adapter = new CommerceStripeAdapter(
      new ConfigService({ STRIPE_SECRET_KEY: "sk_test_fixture" }),
    );
    const charge = { paid: true, refunded: false, disputed: false, amount_refunded: 0 };
    const session = {
      livemode: false,
      payment_status: "paid",
      payment_intent: { status: "succeeded", latest_charge: charge },
    };
    (adapter as unknown as { client: () => unknown }).client = () => ({
      checkout: { sessions: { retrieve: async () => session } },
    });
    assert.equal(await adapter.paid("cs_test"), true);
    charge.refunded = true;
    assert.equal(await adapter.paid("cs_test"), false);
    charge.refunded = false;
    charge.disputed = true;
    assert.equal(await adapter.paid("cs_test"), false);
  });
});
