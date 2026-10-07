import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { prisma } from "@gch/database";
import { catalogVersion, findDeal } from "@gch/commerce";
import { CommerceService } from "../src/commerce/commerce.service";
import { CommerceStripeAdapter } from "../src/commerce/commerce-stripe.adapter";
import { DeliveryAdapter } from "../src/commerce/delivery.adapter";
import type { EmailService } from "../src/email/email.service";

// Never accept a deployment DB: this suite writes only to a loopback test database.
const database = new URL(process.env.DATABASE_URL ?? "mysql://invalid/invalid");
if (
  process.env.COMMERCE_MYSQL_TEST !== "1" ||
  database.protocol !== "mysql:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
  database.pathname !== "/gch_commerce_test"
)
  throw new Error("Requires COMMERCE_MYSQL_TEST=1 and loopback gch_commerce_test database");

const orderIds: string[] = [];
const eventIds: string[] = [];
const operatorId = `ops-${randomUUID()}`;
let guideDirectory: string;
const secret = `whsec_${randomUUID()}`;
const signatureSdk = new Stripe("sk_test_local_fixture");

before(async () => {
  await prisma.$connect();
  await prisma.user.create({ data: { id: operatorId, email: `${operatorId}@example.invalid` } });
  guideDirectory = await mkdtemp(join(tmpdir(), "gch-commerce-mysql-"));
  await writeFile(
    join(guideDirectory, findDeal("brand-identity-development")!.guide!),
    "%PDF-local synthetic onboarding fixture",
  );
});
after(async () => {
  try {
    // Delete only records created by this run, preserving any other test evidence.
    await prisma.commerceJob.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: orderIds }, targetType: "CommerceOrder" },
    });
    await prisma.commerceOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.commerceStripeEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: operatorId } });
  } finally {
    await prisma.$disconnect();
    if (guideDirectory) await rm(guideDirectory, { recursive: true });
  }
});

function service(overrides: Record<string, string> = {}) {
  const config = new ConfigService({
    COMMERCE_ENABLED: "true",
    COMMERCE_ENABLED_DEALS: "brand-identity-development",
    COMMERCE_POLICIES_APPROVED: "true", // Synthetic fixture, not owner approval.
    COMMERCE_STRIPE_WEBHOOK_SECRET: secret,
    COMMERCE_INTAKE_KEY: "11".repeat(32),
    COMMERCE_TAX_MODE: "none",
    COMMERCE_OPS_EMAIL: "ops@example.invalid",
    COMMERCE_OPS_USER_IDS: operatorId,
    COMMERCE_GUIDE_DIRECTORY: guideDirectory,
    COMMERCE_DELIVERY_SECRET: "local-fixture-delivery-secret-at-least-32-characters",
    COMMERCE_API_ORIGIN: "https://ops.example.invalid",
    STRIPE_SECRET_KEY: "sk_test_local_fixture",
    ...overrides,
  });
  const stripe = new CommerceStripeAdapter(config);
  // Real SDK signature validation, synthetic fresh payment reads; no provider network calls.
  stripe.paid = async () => true;
  stripe.create = async () => {
    throw new Error("Network checkout forbidden in MySQL suite");
  };
  const mail: { to: string; subject: string }[] = [];
  const email = {
    isConfigured: true,
    sendRequired: async (message: { to: string; subject: string }) => {
      mail.push(message);
    },
  };
  const delivery = new DeliveryAdapter(config);
  return {
    api: new CommerceService(config, stripe, delivery, email as unknown as EmailService),
    mail,
    delivery,
  };
}

async function order() {
  const id = `mysql-${randomUUID()}`;
  orderIds.push(id);
  return prisma.commerceOrder.create({
    data: {
      id,
      userId: `user-${id}`,
      customerEmail: "customer@example.invalid",
      requestKey: `request-${id}`,
      dealId: "brand-identity-development",
      catalogVersion,
      amountCents: findDeal("brand-identity-development")!.price.cents!,
      stripeSessionId: `cs_test_${id}`,
    },
  });
}

function signedEvent(
  purchase: Awaited<ReturnType<typeof order>>,
  type = "checkout.session.completed",
  paymentStatus = "paid",
  paymentId = `pi_${purchase.id}`,
  eventId = `evt_${randomUUID()}`,
) {
  if (!eventIds.includes(eventId)) eventIds.push(eventId);
  const payload = JSON.stringify({
    id: eventId,
    object: "event",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type,
    data: {
      object: {
        id: purchase.stripeSessionId,
        mode: "payment",
        livemode: false,
        payment_status: paymentStatus,
        payment_intent: paymentId,
        amount_total: purchase.amountCents,
        currency: purchase.currency,
        client_reference_id: purchase.id,
        metadata: {
          order_id: purchase.id,
          deal_id: purchase.dealId,
          catalog_version: purchase.catalogVersion,
        },
      },
    },
  });
  return {
    id: eventId,
    body: Buffer.from(payload),
    signature: signatureSdk.webhooks.generateTestHeaderString({ payload, secret }),
  };
}

describe("commerce transactions against MySQL", { concurrency: false }, () => {
  it("checkout stays unavailable when the operator allowlist has no live user", async () => {
    const { api } = service({ COMMERCE_OPS_USER_IDS: "missing-operator" });
    assert.equal(
      (await api.catalog()).items.some((item) => item.available),
      false,
    );
    await assert.rejects(
      api.checkout("customer", "brand-identity-development", "requestkey1234567"),
    );
    assert.equal(
      await prisma.commerceOrder.count({ where: { requestKey: "requestkey1234567" } }),
      0,
    );
  });
  it("concurrent signed event replays persist exactly one paid transition and job", async () => {
    const purchase = await order();
    const { api } = service();
    const event = signedEvent(purchase);
    const results = await Promise.all(
      Array.from({ length: 12 }, () => api.webhook(event.body, event.signature)),
    );
    assert.equal(results.filter((result) => "replay" in result).length, 11);
    assert.equal(await prisma.commerceStripeEvent.count({ where: { id: event.id } }), 1);
    assert.equal(await prisma.commerceJob.count({ where: { orderId: purchase.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { targetId: purchase.id } }), 1);
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "PAID",
    );
  });

  it("a failed transaction rolls back its claim, transition and audit so the event can retry", async () => {
    const purchase = await order();
    const { api } = service();
    // MySQL VARCHAR(191) rejects the payment ID after the claim and transition writes.
    const bad = signedEvent(purchase, "checkout.session.completed", "paid", "p".repeat(250));
    await assert.rejects(api.webhook(bad.body, bad.signature));
    assert.equal(await prisma.commerceStripeEvent.count({ where: { id: bad.id } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { targetId: purchase.id } }), 0);
    assert.equal(await prisma.commerceJob.count({ where: { orderId: purchase.id } }), 0);
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "CREATED",
    );
    const retry = signedEvent(
      purchase,
      "checkout.session.completed",
      "paid",
      `pi_${purchase.id}`,
      bad.id,
    );
    await api.webhook(retry.body, retry.signature);
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "PAID",
    );
  });

  it("unpaid ACH completion cannot enqueue fulfillment; signed async success can", async () => {
    const purchase = await order();
    const { api } = service();
    const unpaid = signedEvent(purchase, "checkout.session.completed", "unpaid");
    await api.webhook(unpaid.body, unpaid.signature);
    assert.equal(await prisma.commerceJob.count({ where: { orderId: purchase.id } }), 0);
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "CREATED",
    );
    const paid = signedEvent(purchase, "checkout.session.async_payment_succeeded");
    await api.webhook(paid.body, paid.signature);
    assert.equal(await prisma.commerceJob.count({ where: { orderId: purchase.id } }), 1);
  });

  it("the kill switch persists a hold and review alert without releasing access", async () => {
    const purchase = await order();
    const { api, mail } = service({ COMMERCE_ENABLED: "false" });
    const event = signedEvent(purchase);
    await api.webhook(event.body, event.signature);
    await api.process();
    const held = await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.equal(held.status, "HELD");
    assert.ok(held.holdReason);
    assert.ok(mail.some((message) => message.to === "ops@example.invalid"));
    await assert.rejects(api.guide(purchase.id, 0, "invalid"));
    await assert.rejects(api.completeHuman(purchase.id, "ops-test"));
    await api.webhook(event.body, event.signature);
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "HELD",
    );
  });

  it("human delivery persists encrypted intake and audited active status, then refund revokes guides", async () => {
    const purchase = await order();
    const { api, delivery } = service();
    const event = signedEvent(purchase);
    await api.webhook(event.body, event.signature);
    await api.process();
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "PROVISIONING",
    );
    const upload = Buffer.from("%PDF-synthetic brand intake");
    await api.uploadIntake(purchase.userId, purchase.id, upload.toString("base64"));
    await assert.rejects(api.uploadIntake("another-user", purchase.id, upload.toString("base64")));
    const stored = await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.equal(stored.brandIntakeEncrypted!.includes(upload), false);
    assert.deepEqual((await api.opsIntake(purchase.id)).bytes, upload);
    assert.equal((await api.list("another-user")).length, 0);
    await api.completeHuman(purchase.id, "ops-test");
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "ACTIVE",
    );
    const audits = await prisma.auditLog.findMany({ where: { targetId: purchase.id } });
    assert.ok(audits.some((audit) => audit.actor === "ops-test"));
    const link = new URL(delivery.link(purchase.id, purchase.dealId));
    const expires = Number(link.searchParams.get("expires"));
    const signature = link.searchParams.get("signature")!;
    assert.ok((await api.guide(purchase.id, expires, signature)).toString().startsWith("%PDF-"));
    const refundId = `evt_${randomUUID()}`;
    eventIds.push(refundId);
    const payload = JSON.stringify({
      id: refundId,
      type: "charge.refunded",
      livemode: false,
      data: { object: { payment_intent: `pi_${purchase.id}` } },
    });
    await api.webhook(
      Buffer.from(payload),
      signatureSdk.webhooks.generateTestHeaderString({ payload, secret }),
    );
    assert.equal(
      (await prisma.commerceOrder.findUniqueOrThrow({ where: { id: purchase.id } })).status,
      "HELD",
    );
    await assert.rejects(api.guide(purchase.id, expires, signature));
  });
  it("more than fifty completed review jobs cannot starve a new customer's guide", async () => {
    for (let i = 0; i < 55; i++) {
      const older = await order();
      const status = i % 2 === 0 ? "HELD" : "PROVISIONING";
      await prisma.commerceOrder.update({ where: { id: older.id }, data: { status } });
      await prisma.commerceJob.create({
        data: {
          orderId: older.id,
          state: "AWAITING_REVIEW",
          alertSentAt: new Date(),
          deliverySentAt: status === "PROVISIONING" ? new Date() : null,
        },
      });
    }
    const purchase = await order();
    const { api, mail } = service();
    const event = signedEvent(purchase);
    await api.webhook(event.body, event.signature);
    await api.process();
    await api.deliver();
    const job = await prisma.commerceJob.findUniqueOrThrow({ where: { orderId: purchase.id } });
    assert.ok(job.deliverySentAt);
    assert.equal(mail.filter((message) => message.to === "customer@example.invalid").length, 1);
  });
});
