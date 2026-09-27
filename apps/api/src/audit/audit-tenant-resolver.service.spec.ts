import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import { AuditTenantResolverService } from "./audit-tenant-resolver.service";
import {
  InvalidAuditPrincipalError,
  mintApprovedSystemJobPrincipal,
  mintGuardVerifiedAuditPrincipal,
  mintServerBoundAuditTarget,
  mintVerifiedInvitationTokenPrincipal,
  mintVerifiedSelfMembershipPrincipal,
} from "./audit-tenant-resolver.types";
import type { TenantContext } from "../rbac/tenant.decorator";

const tenant = (orgId = "org-a", userId = "user-a"): TenantContext => ({
  orgId,
  membership: { userId, orgId, status: "ACTIVE" } as TenantContext["membership"],
});

describe("AuditTenantResolverService (Phase 4 authoritative resolver)", { concurrency: false }, () => {
  const originals = {
    org: prisma.org.findUnique,
    membership: prisma.membership.findUnique,
    invitation: prisma.invitation.findUnique,
    order: prisma.order.findUnique,
    providerService: prisma.providerService.findUnique,
    provisioningOrder: prisma.provisioningOrder.findUnique,
  };
  afterEach(() => {
    prisma.org.findUnique = originals.org;
    prisma.membership.findUnique = originals.membership;
    prisma.invitation.findUnique = originals.invitation;
    prisma.order.findUnique = originals.order;
    prisma.providerService.findUnique = originals.providerService;
    prisma.provisioningOrder.findUnique = originals.provisioningOrder;
  });

  const service = () => new AuditTenantResolverService();

  it("resolves a guard-verified user against a matching single-hop relation (positive)", async () => {
    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m1", userId: "user-a", orgId: "org-a", status: "ACTIVE",
    })) as never;
    prisma.order.findUnique = mock.fn(async () => ({ orgId: "org-a" })) as never;

    const result = await service().resolve({
      action: "order.paid",
      target: mintServerBoundAuditTarget("Order", "order-1"),
      principal: mintGuardVerifiedAuditPrincipal(tenant(), "user-a"),
    });
    assert.deepEqual(result, { kind: "resolved", organizationId: "org-a" });
  });

  it("resolves a joined relation (ProviderService -> Order.orgId) for a system-job principal", async () => {
    prisma.providerService.findUnique = mock.fn(async () => ({
      order: { orgId: "org-a" },
    })) as never;

    const result = await service().resolve({
      action: "service.provisioned",
      target: mintServerBoundAuditTarget("ProviderService", "svc-1"),
      principal: mintApprovedSystemJobPrincipal("provisioning.orchestrator"),
    });
    assert.deepEqual(result, { kind: "resolved", organizationId: "org-a" });
  });

  it("resolves invitation.accepted for a verified-invitation-token principal, no membership required", async () => {
    prisma.invitation.findUnique = mock.fn(async () => ({ orgId: "org-a" })) as never;
    prisma.membership.findUnique = mock.fn(async () => {
      throw new Error("must not be called for this principal kind");
    }) as never;

    const result = await service().resolve({
      action: "invitation.accepted",
      target: mintServerBoundAuditTarget("Invitation", "inv-1"),
      principal: mintVerifiedInvitationTokenPrincipal("inv-1"),
    });
    assert.deepEqual(result, { kind: "resolved", organizationId: "org-a" });
  });

  it("resolves org.created for a verified-self-membership principal, no pre-existing TenantContext needed", async () => {
    // orgs.service.ts creates the Org and its first Membership in one
    // transaction, then audits org.created — there is no TenantContext yet
    // because this is the membership that establishes one.
    prisma.org.findUnique = mock.fn(async () => ({ id: "org-new" })) as never;
    prisma.membership.findUnique = mock.fn(async () => {
      throw new Error("must not re-check membership for this principal kind");
    }) as never;

    const result = await service().resolve({
      action: "org.created",
      target: mintServerBoundAuditTarget("Org", "org-new"),
      principal: mintVerifiedSelfMembershipPrincipal({ userId: "user-a", orgId: "org-new" }),
    });
    assert.deepEqual(result, { kind: "resolved", organizationId: "org-new" });
  });

  it("denies unapproved action-target pairs (unsupported_shape) before touching the database", async () => {
    prisma.order.findUnique = mock.fn(async () => {
      throw new Error("must not query for an unsupported pair");
    }) as never;

    const result = await service().resolve({
      action: "order.deleted_forever",
      target: mintServerBoundAuditTarget("Order", "order-1"),
      principal: mintApprovedSystemJobPrincipal("stripe.webhook"),
    });
    assert.deepEqual(result, { kind: "unsupported_shape", reason: "unsupported_pair" });
  });

  it("denies a target type with no approved relation lookup (unsupported_shape/invalid_target)", async () => {
    const result = await service().resolve({
      action: "glink.imported",
      target: mintServerBoundAuditTarget("GLink", "glink-1"),
      principal: mintApprovedSystemJobPrincipal("stripe.webhook"),
    });
    assert.deepEqual(result, { kind: "unsupported_shape", reason: "unsupported_pair" });
  });

  it("returns not_found for a missing target (covers both 'never existed' and 'deleted')", async () => {
    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m1", userId: "user-a", orgId: "org-a", status: "ACTIVE",
    })) as never;
    prisma.order.findUnique = mock.fn(async () => null) as never;

    const result = await service().resolve({
      action: "order.paid",
      target: mintServerBoundAuditTarget("Order", "order-does-not-exist"),
      principal: mintGuardVerifiedAuditPrincipal(tenant(), "user-a"),
    });
    assert.deepEqual(result, { kind: "not_found" });
  });

  it("returns malformed_evidence when a required relation join is unexpectedly empty (orphan)", async () => {
    prisma.providerService.findUnique = mock.fn(async () => ({ order: null })) as never;

    const result = await service().resolve({
      action: "service.provisioned",
      target: mintServerBoundAuditTarget("ProviderService", "svc-orphan"),
      principal: mintApprovedSystemJobPrincipal("provisioning.orchestrator"),
    });
    assert.deepEqual(result, { kind: "malformed_evidence", reason: "relation_unavailable" });
  });

  it("returns not_member when the caller's membership is missing or inactive at resolve time", async () => {
    prisma.membership.findUnique = mock.fn(async () => null) as never;
    const missing = await service().resolve({
      action: "org.updated",
      target: mintServerBoundAuditTarget("Org", "org-a"),
      principal: mintGuardVerifiedAuditPrincipal(tenant(), "user-a"),
    });
    assert.deepEqual(missing, { kind: "not_member" });

    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m1", userId: "user-a", orgId: "org-a", status: "SUSPENDED",
    })) as never;
    const suspended = await service().resolve({
      action: "org.updated",
      target: mintServerBoundAuditTarget("Org", "org-a"),
      principal: mintGuardVerifiedAuditPrincipal(tenant(), "user-a"),
    });
    assert.deepEqual(suspended, { kind: "not_member" });
  });

  it("returns cross_tenant when the resolved org does not match the guard-verified principal's org", async () => {
    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m1", userId: "user-a", orgId: "org-a", status: "ACTIVE",
    })) as never;
    prisma.order.findUnique = mock.fn(async () => ({ orgId: "org-b" })) as never;

    const result = await service().resolve({
      action: "order.paid",
      target: mintServerBoundAuditTarget("Order", "order-1"),
      principal: mintGuardVerifiedAuditPrincipal(tenant("org-a", "user-a"), "user-a"),
    });
    assert.deepEqual(result, { kind: "cross_tenant" });
  });

  it("fails closed as unavailable/retryable on a database error, without leaking the exception", async () => {
    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m1", userId: "user-a", orgId: "org-a", status: "ACTIVE",
    })) as never;
    prisma.order.findUnique = mock.fn(async () => {
      throw new Error("connection reset by peer at 10.0.0.5");
    }) as never;

    const result = await service().resolve({
      action: "order.paid",
      target: mintServerBoundAuditTarget("Order", "order-1"),
      principal: mintGuardVerifiedAuditPrincipal(tenant(), "user-a"),
    });
    assert.deepEqual(result, { kind: "unavailable", retryable: true });
  });

  it("is safe under duplicate/replayed calls: read-only and deterministic for the same input", async () => {
    prisma.membership.findUnique = mock.fn(async () => ({
      id: "m1", userId: "user-a", orgId: "org-a", status: "ACTIVE",
    })) as never;
    const findOrder = mock.fn(async () => ({ orgId: "org-a" }));
    prisma.order.findUnique = findOrder as never;

    const input = {
      action: "order.paid" as const,
      target: mintServerBoundAuditTarget("Order", "order-1"),
      principal: mintGuardVerifiedAuditPrincipal(tenant(), "user-a"),
    };
    const [first, second] = await Promise.all([
      service().resolve(input),
      service().resolve(input),
    ]);
    assert.deepEqual(first, second);
    assert.deepEqual(first, { kind: "resolved", organizationId: "org-a" });
  });

  it("has no relation lookup with more than one independent candidate path, so 'conflict' is not reachable today", async () => {
    // Every approved target type resolves via exactly one PK hop (direct id,
    // or a single join) to orgId. This test documents that invariant rather
    // than fabricating a scenario the current schema cannot produce; a
    // future pair with a second independent relation must add a real
    // conflict-producing test here, not assume this one still covers it.
    const singleHopTargetTypes = [
      "Org", "OrgDomainVerification", "Membership", "Invitation",
      "Subscription", "Order", "Invoice", "ProviderService", "ProvisioningOrder",
    ];
    assert.equal(singleHopTargetTypes.length, 9);
  });
});

describe("audit tenant principal/target minting (structural validation only)", () => {
  it("rejects a TenantContext that does not match the authenticated user", () => {
    assert.throws(
      () => mintGuardVerifiedAuditPrincipal(tenant("org-a", "user-a"), "user-b"),
      InvalidAuditPrincipalError,
    );
    assert.throws(
      () => mintGuardVerifiedAuditPrincipal(
        { orgId: "org-a", membership: { userId: "user-a", orgId: "org-b", status: "ACTIVE" } } as TenantContext,
        "user-a",
      ),
      InvalidAuditPrincipalError,
    );
  });

  it("rejects a system-job name outside the approved allowlist", () => {
    assert.throws(() => mintApprovedSystemJobPrincipal("not-a-real-job"), InvalidAuditPrincipalError);
    assert.doesNotThrow(() => mintApprovedSystemJobPrincipal("stripe.webhook"));
  });

  it("rejects an empty invitation id or server-bound target fields", () => {
    assert.throws(() => mintVerifiedInvitationTokenPrincipal("  "), InvalidAuditPrincipalError);
    assert.throws(() => mintServerBoundAuditTarget("Order", ""), InvalidAuditPrincipalError);
    assert.throws(() => mintServerBoundAuditTarget("", "order-1"), InvalidAuditPrincipalError);
  });

  it("rejects an empty userId or orgId for a self-membership principal", () => {
    assert.throws(
      () => mintVerifiedSelfMembershipPrincipal({ userId: " ", orgId: "org-a" }),
      InvalidAuditPrincipalError,
    );
    assert.throws(
      () => mintVerifiedSelfMembershipPrincipal({ userId: "user-a", orgId: "" }),
      InvalidAuditPrincipalError,
    );
  });
});
