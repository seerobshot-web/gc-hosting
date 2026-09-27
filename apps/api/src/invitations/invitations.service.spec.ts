import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { InvitationStatus, Role, prisma } from "@gch/database";
import type { AuditService } from "../audit/audit.service";
import { mintGuardVerifiedAuditPrincipal } from "../audit/audit-tenant-resolver.types";
import type { AuthService } from "../auth/auth.service";
import type { BillingService } from "../billing/billing.service";
import type { EmailService } from "../email/email.service";
import type { TenantContext } from "../rbac/tenant.decorator";
import { InvitationsService } from "./invitations.service";

const tenant: TenantContext = {
  orgId: "org-a",
  membership: { userId: "user-a", orgId: "org-a", status: "ACTIVE" } as TenantContext["membership"],
};

describe("InvitationsService audit wiring (Phase 6, Family 1)", { concurrency: false }, () => {
  const originals = { findUnique: prisma.invitation.findUnique, update: prisma.invitation.update };
  afterEach(() => {
    prisma.invitation.findUnique = originals.findUnique;
    prisma.invitation.update = originals.update;
  });

  it("audits invitation.revoked with a guard-verified principal for the caller's own org", async () => {
    prisma.invitation.findUnique = mock.fn(async () => ({
      id: "inv-1", orgId: "org-a", email: "invitee@example.test", role: Role.MEMBER,
      status: InvitationStatus.PENDING, invitedByUserId: "user-a", tokenHash: "h",
      expiresAt: new Date(Date.now() + 1000 * 60), acceptedAt: null, createdAt: new Date(),
      updatedAt: new Date(),
    })) as never;
    prisma.invitation.update = mock.fn(async () => undefined) as never;

    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction } as unknown as AuditService;
    const service = new InvitationsService(
      audit,
      {} as BillingService,
      {} as EmailService,
      {} as AuthService,
      { get: () => undefined } as never,
    );
    await service.revoke(tenant, "inv-1");

    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; organizationId?: string; userId?: string };
    };
    assert.equal(call.action, "invitation.revoked");
    assert.equal(call.targetType, "Invitation");
    assert.equal(call.targetId, "inv-1");
    assert.deepEqual(call.principal, mintGuardVerifiedAuditPrincipal(tenant, "user-a"));
  });
});
