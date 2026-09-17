import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderStatus, ProviderStatus, prisma } from "@gch/database";
import { AuditService } from "../audit/audit.service";
import { ProvisioningService } from "./provisioning.service";
import { ResellPortalClient } from "./resellportal.client";
import {
  SERVICE_PROVISIONED,
  SERVICE_PROVISIONING_FAILED,
} from "./provisioning.events";
import { ORDER_PAID, SUBSCRIPTION_CANCELLED } from "../billing/billing.events";

// A never-sleeping retry config so tests exercise the real retry loop without
// waiting the production 1s/4s/16s (=21s) backoff budget.
const FAST_RETRY = { delaysMs: [0, 0, 0], sleep: async () => {} };

function makeAudit() {
  return {
    logAction: mock.fn(async (_input: unknown, _tx?: unknown) => {
      void _input;
      void _tx;
    }),
  } as unknown as AuditService & { logAction: ReturnType<typeof mock.fn> };
}

function makeEvents() {
  return { emit: mock.fn((_event: string, _payload?: unknown) => true) } as unknown as EventEmitter2 & {
    emit: ReturnType<typeof mock.fn>;
  };
}

// ---------------------------------------------------------------------------
// Phase 5: event-driven durable provisioning
// ---------------------------------------------------------------------------
describe("ProvisioningService.provisionService", { concurrency: false }, () => {
  const originals = {
    psFindUnique: prisma.providerService.findUnique,
    psUpdate: prisma.providerService.update,
    idemFindUnique: prisma.idempotencyRecord.findUnique,
    orderFind: prisma.order.findUniqueOrThrow,
    transaction: prisma.$transaction,
  };

  afterEach(() => {
    prisma.providerService.findUnique = originals.psFindUnique;
    prisma.providerService.update = originals.psUpdate;
    prisma.idempotencyRecord.findUnique = originals.idemFindUnique;
    prisma.order.findUniqueOrThrow = originals.orderFind;
    prisma.$transaction = originals.transaction;
  });

  const order = {
    id: "order-1",
    orgId: "org-1",
    planId: "plan-1",
    status: OrderStatus.PAID,
  };

  function wireTransaction() {
    // A single tx double reused by every $transaction() call in the flow.
    const tx = {
      order: { update: mock.fn(async (_args: { data: { status: OrderStatus } }) => ({ ...order, status: OrderStatus.ACTIVE })) },
      providerService: {
        create: mock.fn(async () => ({
          id: "ps-1",
          orderId: order.id,
          resellPortalId: `pending:${order.id}`,
          status: ProviderStatus.PROVISIONING,
        })),
        update: mock.fn(async (args: { data: { status: ProviderStatus } }) => ({
          id: "ps-1",
          orderId: order.id,
          resellPortalId: "rp-svc-1",
          status: args.data.status,
          provisionedAt: new Date(),
        })),
      },
      idempotencyRecord: { create: mock.fn(async () => ({})) },
    };
    prisma.$transaction = (async (cb: (t: unknown) => unknown) => cb(tx)) as never;
    return tx;
  }

  it("provisions happy-path: PROVISIONING row -> ResellPortal -> ACTIVE + record + event", async () => {
    prisma.providerService.findUnique = mock.fn(async () => null) as never;
    prisma.idempotencyRecord.findUnique = mock.fn(async () => null) as never;
    prisma.order.findUniqueOrThrow = mock.fn(async () => order) as never;
    const tx = wireTransaction();

    const createService = mock.fn(async (_params: unknown, _key: string) => ({ service_id: "rp-svc-1", status: "active" }));
    const resellPortal = { createService } as unknown as ResellPortalClient;
    const audit = makeAudit();
    const events = makeEvents();
    const service = new ProvisioningService(resellPortal, audit, events);

    const result = await service.provisionService("order-1", "idem-key-1");

    assert.equal(createService.mock.callCount(), 1);
    // idempotency key forwarded to the adapter
    assert.equal(createService.mock.calls[0]!.arguments[1], "idem-key-1");
    // ProviderService created PROVISIONING before the RP call, updated ACTIVE after
    assert.equal(tx.providerService.create.mock.callCount(), 1);
    assert.equal(tx.providerService.update.mock.callCount(), 1);
    assert.equal(result.status, ProviderStatus.ACTIVE);
    // idempotency record persisted + service.provisioned emitted + audited
    assert.equal(tx.idempotencyRecord.create.mock.callCount(), 1);
    assert.equal(events.emit.mock.calls[0]!.arguments[0], SERVICE_PROVISIONED);
    const auditActions = audit.logAction.mock.calls.map(
      (c) => (c.arguments[0] as { action: string }).action,
    );
    assert.ok(auditActions.includes(SERVICE_PROVISIONED));
  });

  it("is an idempotent no-op when an ACTIVE ProviderService already exists", async () => {
    const activeSvc = {
      id: "ps-1",
      orderId: "order-1",
      resellPortalId: "rp-svc-1",
      status: ProviderStatus.ACTIVE,
    };
    prisma.providerService.findUnique = mock.fn(async () => activeSvc) as never;
    const createService = mock.fn(async (_params: unknown, _key: string) => ({ service_id: "x", status: "active" }));
    const resellPortal = { createService } as unknown as ResellPortalClient;
    const events = makeEvents();
    const service = new ProvisioningService(resellPortal, makeAudit(), events);

    const result = await service.provisionService("order-1", "idem-key-1");

    assert.deepEqual(result, activeSvc);
    assert.equal(createService.mock.callCount(), 0); // no external call
    assert.equal(events.emit.mock.callCount(), 0);
  });

  it("replays a cached result when an IdempotencyRecord exists", async () => {
    const cachedSvc = {
      id: "ps-1",
      orderId: "order-1",
      resellPortalId: "rp-svc-1",
      status: ProviderStatus.ACTIVE,
    };
    // First findUnique (step a) -> not ACTIVE-yet null; replay lookup returns svc.
    let call = 0;
    prisma.providerService.findUnique = mock.fn(async () => {
      call += 1;
      return call === 1 ? null : cachedSvc;
    }) as never;
    prisma.idempotencyRecord.findUnique = mock.fn(async () => ({
      key: "idem-key-1",
      result: {},
    })) as never;
    const createService = mock.fn(async (_params: unknown, _key: string) => ({ service_id: "x", status: "active" }));
    const resellPortal = { createService } as unknown as ResellPortalClient;
    const service = new ProvisioningService(resellPortal, makeAudit(), makeEvents());

    const result = await service.provisionService("order-1", "idem-key-1");

    assert.deepEqual(result, cachedSvc);
    assert.equal(createService.mock.callCount(), 0);
  });

  it("retries a transient ResellPortal failure and succeeds on the 2nd attempt", async () => {
    prisma.providerService.findUnique = mock.fn(async () => null) as never;
    prisma.idempotencyRecord.findUnique = mock.fn(async () => null) as never;
    prisma.order.findUniqueOrThrow = mock.fn(async () => order) as never;
    wireTransaction();

    let attempts = 0;
    const createService = mock.fn(async (_params: unknown, _key: string) => {
      attempts += 1;
      if (attempts === 1) throw new Error("503 from ResellPortal");
      return { service_id: "rp-svc-1", status: "active" };
    });
    const resellPortal = { createService } as unknown as ResellPortalClient;
    const events = makeEvents();
    const service = new ProvisioningService(resellPortal, makeAudit(), events);

    const result = await service.provisionService("order-1", "idem-key-1", FAST_RETRY);

    assert.equal(createService.mock.callCount(), 2);
    assert.equal(result.status, ProviderStatus.ACTIVE);
    assert.equal(events.emit.mock.calls[0]!.arguments[0], SERVICE_PROVISIONED);
  });

  it("exhausts after 3 attempts: order FAILED, provisioning_failed emitted, rethrows", async () => {
    prisma.providerService.findUnique = mock.fn(async () => null) as never;
    prisma.idempotencyRecord.findUnique = mock.fn(async () => null) as never;
    prisma.order.findUniqueOrThrow = mock.fn(async () => order) as never;
    const tx = wireTransaction();

    const createService = mock.fn(async (_params: unknown, _key: string) => {
      throw new Error("ResellPortal down");
    });
    const resellPortal = { createService } as unknown as ResellPortalClient;
    const audit = makeAudit();
    const events = makeEvents();
    const service = new ProvisioningService(resellPortal, audit, events);

    await assert.rejects(
      service.provisionService("order-1", "idem-key-1", FAST_RETRY),
      /ResellPortal down/,
    );

    assert.equal(createService.mock.callCount(), 3); // 3 attempts
    // failure event emitted
    const emitted = events.emit.mock.calls.map((c) => c.arguments[0]);
    assert.ok(emitted.includes(SERVICE_PROVISIONING_FAILED));
    // order moved to FAILED and provider row TERMINATED in the cleanup tx
    const orderStatuses = tx.order.update.mock.calls.map(
      (c) => (c.arguments[0] as { data: { status: OrderStatus } }).data.status,
    );
    assert.ok(orderStatuses.includes(OrderStatus.FAILED));
    const failAudits = audit.logAction.mock.calls.map(
      (c) => (c.arguments[0] as { action: string }).action,
    );
    assert.ok(failAudits.includes(SERVICE_PROVISIONING_FAILED));
  });
});

// ---------------------------------------------------------------------------
// Suspension & termination
// ---------------------------------------------------------------------------
describe("ProvisioningService cancellation path", { concurrency: false }, () => {
  const originals = {
    psFind: prisma.providerService.findUniqueOrThrow,
    orderFind: prisma.order.findUniqueOrThrow,
    transaction: prisma.$transaction,
  };
  afterEach(() => {
    prisma.providerService.findUniqueOrThrow = originals.psFind;
    prisma.order.findUniqueOrThrow = originals.orderFind;
    prisma.$transaction = originals.transaction;
  });

  function wire(providerStatusResult: ProviderStatus) {
    prisma.providerService.findUniqueOrThrow = mock.fn(async () => ({
      id: "ps-1",
      orderId: "order-1",
      resellPortalId: "rp-svc-1",
      status: ProviderStatus.ACTIVE,
    })) as never;
    prisma.order.findUniqueOrThrow = mock.fn(async () => ({
      id: "order-1",
      status: OrderStatus.ACTIVE,
    })) as never;
    const tx = {
      providerService: {
        update: mock.fn(async (_args: { data: { status: ProviderStatus } }) => ({ id: "ps-1", status: providerStatusResult })),
      },
      order: { update: mock.fn(async (_args: { data: { status: OrderStatus } }) => ({ id: "order-1", status: OrderStatus.CANCELLED })) },
    };
    prisma.$transaction = (async (cb: (t: unknown) => unknown) => cb(tx)) as never;
    return tx;
  }

  it("terminateService: calls RP terminate w/ deterministic key, sets TERMINATED + order CANCELLED", async () => {
    const tx = wire(ProviderStatus.TERMINATED);
    const terminateService = mock.fn(async (_id: string, _key: string) => ({ service_id: "rp-svc-1", status: "terminated" }));
    const resellPortal = { terminateService } as unknown as ResellPortalClient;
    const audit = makeAudit();
    const service = new ProvisioningService(resellPortal, audit, makeEvents());

    await service.terminateService("order-1");

    assert.equal(terminateService.mock.callCount(), 1);
    assert.equal(terminateService.mock.calls[0]!.arguments[0], "rp-svc-1");
    // deterministic idempotency key derived from the ProviderService id
    assert.equal(
      terminateService.mock.calls[0]!.arguments[1],
      ResellPortalClient.idempotencyKey("providerService", "ps-1", "terminateService"),
    );
    assert.equal(
      (tx.providerService.update.mock.calls[0]!.arguments[0] as { data: { status: ProviderStatus } })
        .data.status,
      ProviderStatus.TERMINATED,
    );
    assert.equal(
      (tx.order.update.mock.calls[0]!.arguments[0] as { data: { status: OrderStatus } }).data.status,
      OrderStatus.CANCELLED,
    );
    assert.equal(
      (audit.logAction.mock.calls[0]!.arguments[0] as { action: string }).action,
      "service.terminated",
    );
  });

  it("suspendService: calls RP suspend and sets SUSPENDED + order CANCELLED", async () => {
    const tx = wire(ProviderStatus.SUSPENDED);
    const suspendService = mock.fn(async (_id: string, _key: string) => ({ service_id: "rp-svc-1", status: "suspended" }));
    const resellPortal = { suspendService } as unknown as ResellPortalClient;
    const service = new ProvisioningService(resellPortal, makeAudit(), makeEvents());

    await service.suspendService("order-1");

    assert.equal(suspendService.mock.callCount(), 1);
    assert.equal(
      (tx.providerService.update.mock.calls[0]!.arguments[0] as { data: { status: ProviderStatus } })
        .data.status,
      ProviderStatus.SUSPENDED,
    );
  });
});

// ---------------------------------------------------------------------------
// Event listeners are wired to the right handlers
// ---------------------------------------------------------------------------
describe("ProvisioningService event listeners", { concurrency: false }, () => {
  it("handleOrderPaid delegates to provisionService with a deterministic key", async () => {
    const service = new ProvisioningService(
      {} as unknown as ResellPortalClient,
      makeAudit(),
      makeEvents(),
    );
    const provision = mock.fn(async (_orderId: string, _key: string) => ({}) as never);
    service.provisionService = provision as never;

    await service.handleOrderPaid({
      orderId: "order-1",
      orgId: "org-1",
      planId: "plan-1",
      stripePaymentId: "pi_1",
    });

    assert.equal(provision.mock.callCount(), 1);
    assert.equal(provision.mock.calls[0]!.arguments[0], "order-1");
    assert.equal(
      provision.mock.calls[0]!.arguments[1],
      ResellPortalClient.idempotencyKey("order", "order-1", "provisionService"),
    );
  });

  it("handleOrderPaid swallows provisioning errors (listener never throws)", async () => {
    const service = new ProvisioningService(
      {} as unknown as ResellPortalClient,
      makeAudit(),
      makeEvents(),
    );
    service.provisionService = (async () => {
      throw new Error("boom");
    }) as never;

    await assert.doesNotReject(
      service.handleOrderPaid({
        orderId: "order-1",
        orgId: "org-1",
        planId: "plan-1",
        stripePaymentId: null,
      }),
    );
  });

  it("handleSubscriptionCancelled delegates to terminateService when an order is present", async () => {
    const service = new ProvisioningService(
      {} as unknown as ResellPortalClient,
      makeAudit(),
      makeEvents(),
    );
    const terminate = mock.fn(async (_orderId: string) => ({}) as never);
    service.terminateService = terminate as never;

    await service.handleSubscriptionCancelled({
      orgId: "org-1",
      stripeSubscriptionId: "sub_1",
      orderId: "order-1",
    });

    assert.equal(terminate.mock.callCount(), 1);
    assert.equal(terminate.mock.calls[0]!.arguments[0], "order-1");
  });

  it("handleSubscriptionCancelled is a no-op when no order is linked", async () => {
    const service = new ProvisioningService(
      {} as unknown as ResellPortalClient,
      makeAudit(),
      makeEvents(),
    );
    const terminate = mock.fn(async (_orderId: string) => ({}) as never);
    service.terminateService = terminate as never;

    await service.handleSubscriptionCancelled({
      orgId: "org-1",
      stripeSubscriptionId: "sub_1",
      orderId: null,
    });

    assert.equal(terminate.mock.callCount(), 0);
  });
});

// ---------------------------------------------------------------------------
// Legacy ResellPortal flow (retained) — constructor now takes EventEmitter2
// ---------------------------------------------------------------------------
describe("ProvisioningService.placeOrder (legacy)", { concurrency: false }, () => {
  const input = {
    clientId: "client-1",
    resellPortalClientId: "rp-client-1",
    cpanelUsername: "gracechurch",
    primaryDomain: "grace.example",
  };
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
    const persistedOrder = { ...localOrder, resellPortalOrderId: "rp-order-42" };
    prisma.provisioningOrder.create = mock.fn(async () => localOrder) as never;

    const transactionOrderUpdate = mock.fn(async () => persistedOrder);
    const transactionClient = { provisioningOrder: { update: transactionOrderUpdate } };
    prisma.$transaction = (async (callback: (tx: unknown) => unknown) =>
      callback(transactionClient)) as never;

    const resellPortal = {
      placeOrder: mock.fn(async () => ({ order_id: "rp-order-42" })),
    } as unknown as ResellPortalClient;
    const logAction = mock.fn(async (_action: unknown, _tx?: unknown) => {
      void _action;
      void _tx;
    });
    const service = new ProvisioningService(
      resellPortal,
      { logAction } as unknown as AuditService,
      makeEvents(),
    );

    const result = await service.placeOrder(input);

    assert.equal(result.resellPortalOrderId, "rp-order-42");
    assert.equal(transactionOrderUpdate.mock.callCount(), 1);
    assert.equal(logAction.mock.callCount(), 1);
  });

  it("records the failed status before returning a placement error", async () => {
    const placementError = new Error("ResellPortal unavailable");
    const localOrder = { id: "order-2", ...input, status: "provisioning" };
    prisma.provisioningOrder.create = mock.fn(async () => localOrder) as never;
    const update = mock.fn(async (_args: unknown) => ({ ...localOrder, status: "failed" }));
    prisma.provisioningOrder.update = update as never;

    const resellPortal = {
      placeOrder: mock.fn(async () => {
        throw placementError;
      }),
    } as unknown as ResellPortalClient;
    const logAction = mock.fn(async (_action: unknown) => {
      void _action;
    });
    const service = new ProvisioningService(
      resellPortal,
      { logAction } as unknown as AuditService,
      makeEvents(),
    );

    await assert.rejects(service.placeOrder(input), placementError);
    assert.deepEqual(update.mock.calls[0]!.arguments[0], {
      where: { id: "order-2" },
      data: { status: "failed" },
    });
    assert.equal(logAction.mock.callCount(), 1);
  });
});
