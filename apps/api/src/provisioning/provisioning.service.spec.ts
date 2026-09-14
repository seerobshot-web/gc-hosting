import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import { ProvisioningService } from "./provisioning.service";
import { ResellPortalClient } from "./resellportal.client";

const input = {
  clientId: "client-1",
  resellPortalClientId: "rp-client-1",
  cpanelUsername: "gracechurch",
  primaryDomain: "grace.example",
};

describe("ProvisioningService.placeOrder", { concurrency: false }, () => {
  const originalCreate = prisma.provisioningOrder.create;
  const originalUpdate = prisma.provisioningOrder.update;
  const originalTransaction = prisma.$transaction;

  afterEach(() => {
    prisma.provisioningOrder.create = originalCreate;
    prisma.provisioningOrder.update = originalUpdate;
    prisma.$transaction = originalTransaction;
  });

  it("returns the order with its persisted ResellPortal order ID", async () => {
    const localOrder = { id: "order-1", ...input, status: "provisioning" };
    const persistedOrder = {
      ...localOrder,
      resellPortalOrderId: "rp-order-42",
    };
    prisma.provisioningOrder.create = mock.fn(async () => localOrder) as never;

    const transactionOrderUpdate = mock.fn(async () => persistedOrder);
    const transactionClient = {
      provisioningOrder: { update: transactionOrderUpdate },
    };
    prisma.$transaction = (async (callback: (tx: unknown) => unknown) =>
      callback(transactionClient)) as never;

    const resellPortal = {
      placeOrder: mock.fn(async () => ({ order_id: "rp-order-42" })),
    } as unknown as ResellPortalClient;
    const logAction = mock.fn(async (_action: unknown, _tx?: unknown) => {
      void _action;
      void _tx;
    });
    const service = new ProvisioningService(resellPortal, {
      logAction,
    } as unknown as AuditService);

    const result = await service.placeOrder(input);

    assert.equal(result.resellPortalOrderId, "rp-order-42");
    assert.equal(transactionOrderUpdate.mock.callCount(), 1);
    assert.equal(logAction.mock.callCount(), 1);
    assert.equal(logAction.mock.calls[0]!.arguments[1], transactionClient);
  });

  it("records the failed status before returning a placement error", async () => {
    const placementError = new Error("ResellPortal unavailable");
    const localOrder = { id: "order-2", ...input, status: "provisioning" };
    prisma.provisioningOrder.create = mock.fn(async () => localOrder) as never;
    const update = mock.fn(async (_args: unknown) => {
      void _args;
      return { ...localOrder, status: "failed" };
    });
    prisma.provisioningOrder.update = update as never;

    const resellPortal = {
      placeOrder: mock.fn(async () => {
        throw placementError;
      }),
    } as unknown as ResellPortalClient;
    const logAction = mock.fn(async (_action: unknown) => {
      void _action;
    });
    const service = new ProvisioningService(resellPortal, {
      logAction,
    } as unknown as AuditService);

    await assert.rejects(service.placeOrder(input), placementError);
    assert.deepEqual(update.mock.calls[0]!.arguments[0], {
      where: { id: "order-2" },
      data: { status: "failed" },
    });
    assert.equal(logAction.mock.callCount(), 1);
  });
});
