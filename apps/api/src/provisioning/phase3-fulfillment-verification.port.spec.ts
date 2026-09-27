import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import type { ResellPortalClient } from "./resellportal.client";
import { Phase3ResellPortalFulfillmentVerificationPort } from "./phase3-fulfillment-verification.port";

const orderId = "order-1";
const orgId = "org-1";
const providerService = { id: "svc-1", resellPortalId: "rp-svc-1" };

describe("Phase3ResellPortalFulfillmentVerificationPort (Phase 11 fulfillment observation)", { concurrency: false }, () => {
  const originalFindUnique = prisma.order.findUnique;
  afterEach(() => {
    prisma.order.findUnique = originalFindUnique;
  });

  function portWith(getServiceStatus: (id: string, key: string) => Promise<unknown>) {
    const resellPortal = { getServiceStatus: mock.fn(getServiceStatus) } as unknown as ResellPortalClient;
    return { port: new Phase3ResellPortalFulfillmentVerificationPort(resellPortal), resellPortal };
  }

  it("reports verified when the provider echoes the exact service as active", async () => {
    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId, providerService })) as never;
    const { port } = portWith(async () => ({ service_id: "rp-svc-1", status: "active" }));

    assert.deepEqual(await port.verify(orderId, orgId), {
      orderId, orgId, authority: "resellportal", verified: true, evidenceRef: "rp-svc-1",
    });
  });

  it("accepts a case-different but otherwise exact 'active' status", async () => {
    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId, providerService })) as never;
    const { port } = portWith(async () => ({ service_id: "rp-svc-1", status: "  ACTIVE  " }));

    assert.equal((await port.verify(orderId, orgId)).verified, true);
  });

  it("fails closed for any status other than active", async () => {
    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId, providerService })) as never;
    for (const status of ["suspended", "terminated", "provisioning", "unknown", ""]) {
      const { port } = portWith(async () => ({ service_id: "rp-svc-1", status }));
      assert.deepEqual(await port.verify(orderId, orgId), {
        orderId, orgId, authority: "resellportal", verified: false, evidenceRef: null,
      }, status);
    }
  });

  it("fails closed when the provider echoes a different service id (integrity check)", async () => {
    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId, providerService })) as never;
    const { port } = portWith(async () => ({ service_id: "rp-svc-DIFFERENT", status: "active" }));

    assert.equal((await port.verify(orderId, orgId)).verified, false);
  });

  it("fails closed when the provider call throws", async () => {
    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId, providerService })) as never;
    const { port } = portWith(async () => { throw new Error("network error"); });

    assert.deepEqual(await port.verify(orderId, orgId), {
      orderId, orgId, authority: "resellportal", verified: false, evidenceRef: null,
    });
  });

  it("never calls the provider when there is no order, wrong org, or no provisioned service yet", async () => {
    const getServiceStatus = mock.fn(async () => ({ service_id: "rp-svc-1", status: "active" }));
    const { port } = portWith(getServiceStatus);

    prisma.order.findUnique = mock.fn(async () => null) as never;
    assert.equal((await port.verify(orderId, orgId)).verified, false);
    assert.equal(getServiceStatus.mock.callCount(), 0);

    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId: "other-org", providerService })) as never;
    assert.equal((await port.verify(orderId, orgId)).verified, false);
    assert.equal(getServiceStatus.mock.callCount(), 0);

    prisma.order.findUnique = mock.fn(async () => ({ id: orderId, orgId, providerService: null })) as never;
    assert.equal((await port.verify(orderId, orgId)).verified, false);
    assert.equal(getServiceStatus.mock.callCount(), 0);
  });
});
