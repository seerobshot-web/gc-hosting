import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";
import { PERMISSION_KEY } from "../rbac/require-permission.decorator";
import { OrderReadinessController } from "./order-readiness.controller";
import { OrderReadinessService } from "./order-readiness.service";

describe("read-only, tenant-scoped order readiness", { concurrency: false }, () => {
  const originalFind = prisma.order.findFirst;
  afterEach(() => { prisma.order.findFirst = originalFind; });

  it("requires org-scoped provisioning read permission", () => {
    assert.deepEqual(
      Reflect.getMetadata(PERMISSION_KEY, OrderReadinessController.prototype.findForOrg),
      { permission: "provisioning:read", scope: "org" },
    );
  });

  it("scopes the database query and withholds readiness even for a locally ACTIVE order", async () => {
    const find = mock.fn(async (_args: unknown) => ({ id: "order-a", orgId: "org-a", status: "ACTIVE" }));
    prisma.order.findFirst = find as never;
    const result = await new OrderReadinessService().findForOrg("order-a", "org-a");
    assert.deepEqual(find.mock.calls[0]!.arguments[0], {
      where: { id: "order-a", orgId: "org-a" },
      select: { id: true, orgId: true, status: true },
    });
    assert.equal(result.ready, false);
    assert.equal(result.reason, "product_unapproved");
    assert.equal(result.paymentVerified, false);
    assert.equal(result.fulfillmentVerified, false);
    assert.equal(result.localOrderStatus, "ACTIVE");
    assert.equal("stripePaymentId" in result, false);
    assert.equal("providerService" in result, false);
  });

  it("hides a cross-tenant or unknown order with the same not-found response", async () => {
    const find = mock.fn(async (_args: unknown) => null);
    prisma.order.findFirst = find as never;
    const service = new OrderReadinessService();
    await assert.rejects(service.findForOrg("other-order", "org-a"), NotFoundException);
    assert.deepEqual(find.mock.calls[0]!.arguments[0], {
      where: { id: "other-order", orgId: "org-a" },
      select: { id: true, orgId: true, status: true },
    });
  });

  it("reads only and cannot invoke a payment, provider, or entitlement mutation", async () => {
    prisma.order.findFirst = mock.fn(async () => ({
      id: "order-a", orgId: "org-a", status: "PAID",
    })) as never;
    const result = await new OrderReadinessService().findForOrg("order-a", "org-a");
    assert.equal(result.ready, false);
    assert.equal(result.paymentVerified, false);
    assert.equal(result.fulfillmentVerified, false);
  });
});
