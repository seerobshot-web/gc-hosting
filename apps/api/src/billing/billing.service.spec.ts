import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { ConflictException } from "@nestjs/common";
import { prisma, type Membership } from "@gch/database";
import {
  mintApprovedSystemJobPrincipal,
  mintGuardVerifiedAuditPrincipal,
} from "../audit/audit-tenant-resolver.types";
import type { TenantContext } from "../rbac/tenant.decorator";
import { BillingService } from "./billing.service";

function makeTenant(): TenantContext {
  return {
    orgId: "org-1",
    membership: { userId: "user-1", orgId: "org-1", status: "ACTIVE" } as Membership,
  };
}

describe("BillingService.createProductCheckoutSession", () => {
  it("fails closed before calling Stripe when the server-side mapping is incomplete", async () => {
    const stripe = {
      createCheckoutSession: mock.fn(async () => ({
        id: "cs_1",
        url: "https://checkout.stripe.test/session/cs_1",
        customerId: "cus_1",
      })),
    };
    const audit = { logAction: mock.fn(async () => undefined) };
    const service = new BillingService(stripe as never, audit as never);

    await assert.rejects(
      service.createProductCheckoutSession(makeTenant(), {
        gchSlug: "web-hosting",
        billingCycle: "monthly",
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        String((error.getResponse() as { message?: string }).message).includes(
          "pending contract verification",
        ),
    );

    assert.equal(stripe.createCheckoutSession.mock.callCount(), 0);
    assert.equal(audit.logAction.mock.callCount(), 0);
  });
});

describe("BillingService audit wiring (Phase 6, Family 3)", { concurrency: false }, () => {
  const originals = {
    planFindUnique: prisma.plan.findUnique,
    subFindUnique: prisma.subscription.findUnique,
    membershipCount: prisma.membership.count,
    subUpdate: prisma.subscription.update,
  };
  afterEach(() => {
    prisma.plan.findUnique = originals.planFindUnique;
    prisma.subscription.findUnique = originals.subFindUnique;
    prisma.membership.count = originals.membershipCount;
    prisma.subscription.update = originals.subUpdate;
  });

  it("audits billing.checkout_started with a guard-verified principal", async () => {
    prisma.plan.findUnique = mock.fn(async () => ({
      id: "plan-1", stripePriceId: "price_1", name: "Pro", seatLimit: null,
      pricePerSeatCents: 1000, isActive: true, createdAt: new Date(),
    })) as never;
    prisma.subscription.findUnique = mock.fn(async () => ({
      id: "sub-1", orgId: "org-1", planId: null, stripeCustomerId: "cus_1",
      stripeSubscriptionId: null, stripeSubscriptionItemId: null, status: "canceled",
      currentPeriodEnd: null, cancelAtPeriodEnd: false, seatsPurchased: 0,
      createdAt: new Date(), updatedAt: new Date(),
    })) as never;
    prisma.membership.count = mock.fn(async () => 1) as never;

    const stripe = {
      createCheckoutSession: mock.fn(async () => ({ id: "cs_1", url: "https://checkout.test/cs_1" })),
      portalOrigin: "https://portal.test",
    };
    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction };
    const service = new BillingService(stripe as never, audit as never);

    await service.createCheckoutSession(makeTenant(), "plan-1", "owner@example.test");

    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; organizationId?: string; userId?: string };
    };
    assert.equal(call.action, "billing.checkout_started");
    assert.equal(call.targetType, "Org");
    assert.equal(call.targetId, "org-1");
    assert.deepEqual(call.principal, mintGuardVerifiedAuditPrincipal(makeTenant(), "user-1"));
  });

  it("audits subscription.seats_synced with an approved_system_job principal — no TenantContext reaches this path", async () => {
    prisma.subscription.findUnique = mock.fn(async () => ({
      id: "sub-1", orgId: "org-1", planId: "plan-1", stripeCustomerId: "cus_1",
      stripeSubscriptionId: "si_1", stripeSubscriptionItemId: "sub_item_1", status: "active",
      currentPeriodEnd: null, cancelAtPeriodEnd: false, seatsPurchased: 1,
      createdAt: new Date(), updatedAt: new Date(),
    })) as never;
    prisma.membership.count = mock.fn(async () => 2) as never;
    prisma.subscription.update = mock.fn(async () => undefined) as never;

    const stripe = {
      client: { subscriptionItems: { update: mock.fn(async () => undefined) } },
    };
    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction };
    const service = new BillingService(stripe as never, audit as never);

    await service.syncSeats("org-1", "user:someone");

    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; jobName?: string };
    };
    assert.equal(call.action, "subscription.seats_synced");
    assert.equal(call.targetType, "Subscription");
    assert.equal(call.targetId, "sub-1");
    assert.deepEqual(call.principal, mintApprovedSystemJobPrincipal("billing.seat_sync"));
  });
});
