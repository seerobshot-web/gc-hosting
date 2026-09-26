import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { OrderStatus, Prisma, prisma } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import { PaidOrderRecoveryService } from "./paid-order-recovery.service";

describe("PaidOrderRecoveryService", { concurrency: false }, () => {
  const original = {
    findMany: prisma.order.findMany,
    transaction: prisma.$transaction,
    findUnique: prisma.order.findUnique,
    create: prisma.idempotencyRecord.create,
  };
  afterEach(() => {
    prisma.order.findMany = original.findMany;
    prisma.$transaction = original.transaction;
    prisma.order.findUnique = original.findUnique;
    prisma.idempotencyRecord.create = original.create;
  });

  function setup(options: { active?: boolean; failAudit?: boolean } = {}) {
    const keys = new Set<string>();
    const audit = {
      logAction: mock.fn(async () => {
        if (options.failAudit) throw new Error("audit unavailable");
      }),
    } as unknown as AuditService & { logAction: ReturnType<typeof mock.fn> };
    const findMany = mock.fn(async () => [{
      id: "order_1", orgId: "org_1", updatedAt: new Date("2026-01-01T00:00:00Z"),
    }]);
    prisma.order.findMany = findMany as never;
    prisma.order.findUnique = mock.fn(async () => ({
      status: options.active ? OrderStatus.ACTIVE : OrderStatus.PAID,
      orgId: "org_1",
      stripePaymentId: "pi_fixture",
      providerService: options.active ? { id: "svc_1" } : null,
    })) as never;
    prisma.$transaction = mock.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)) as never;
    const create = mock.fn(async ({ data }: { data: { key: string } }) => {
      if (keys.has(data.key)) {
        throw new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002", clientVersion: "test",
        });
      }
      keys.add(data.key);
      return {};
    });
    prisma.idempotencyRecord.create = create as never;
    return { service: new PaidOrderRecoveryService(audit), audit, findMany, create, keys };
  }

  it("discovers an aged paid order after an event was persisted but no listener ran", async () => {
    const { service, audit, findMany } = setup();
    assert.equal(await service.discoverStrandedOrders(new Date("2026-01-01T00:10:00Z")), 1);
    assert.equal(audit.logAction.mock.callCount(), 1);
    const query = findMany.mock.calls[0]!.arguments[0] as unknown as {
      where: { status: string; stripePaymentId: unknown; providerService: unknown; updatedAt: unknown };
      take: number;
    };
    assert.equal(query.where.status, OrderStatus.PAID);
    assert.deepEqual(query.where.providerService, { is: null });
    assert.equal(query.take, 100);
    const action = audit.logAction.mock.calls[0]!.arguments[0] as unknown as {
      action: string; metadata: { orgId: string; paymentVerified: boolean; fulfillmentVerified: boolean };
    };
    assert.equal(action.action, "order.recovery_review_required");
    assert.deepEqual(action.metadata, {
      orgId: "org_1", reason: "paid_order_without_provider_service",
      paymentVerified: false, fulfillmentVerified: false,
    });
  });

  it("does not record a second review on repeated or concurrent sweeps", async () => {
    const { service, audit } = setup();
    const now = new Date("2026-01-01T00:10:00Z");
    const results = await Promise.all([
      service.discoverStrandedOrders(now), service.discoverStrandedOrders(now),
    ]);
    assert.deepEqual(results.sort(), [0, 1]);
    assert.equal(await service.discoverStrandedOrders(now), 0);
    assert.equal(audit.logAction.mock.callCount(), 1);
  });

  it("skips a candidate whose order has advanced since discovery", async () => {
    const { service, audit, create } = setup({ active: true });
    assert.equal(await service.discoverStrandedOrders(new Date("2026-01-01T00:10:00Z")), 0);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(audit.logAction.mock.callCount(), 0);
  });

  it("surfaces a review write failure for retry on the next scheduled run", async () => {
    const { service } = setup({ failAudit: true });
    await assert.rejects(service.discoverStrandedOrders(new Date("2026-01-01T00:10:00Z")));
  });
});
