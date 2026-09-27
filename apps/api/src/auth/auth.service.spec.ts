import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { prisma } from "@gch/database";
import type { AuditService } from "../audit/audit.service";
import { mintVerifiedSelfMembershipPrincipal } from "../audit/audit-tenant-resolver.types";
import type { BillingService } from "../billing/billing.service";
import { AuthService } from "./auth.service";

function fakeJwt() {
  return { sign: mock.fn(() => "token") } as unknown as import("@nestjs/jwt").JwtService;
}

describe("AuthService auto-join audit wiring (Phase 6, Family 2)", { concurrency: false }, () => {
  const originals = {
    userFindUnique: prisma.user.findUnique,
    userCreate: prisma.user.create,
    orgFindUnique: prisma.org.findUnique,
    membershipFindUnique: prisma.membership.findUnique,
    membershipCreate: prisma.membership.create,
    refreshTokenCreate: prisma.refreshToken.create,
  };
  afterEach(() => {
    prisma.user.findUnique = originals.userFindUnique;
    prisma.user.create = originals.userCreate;
    prisma.org.findUnique = originals.orgFindUnique;
    prisma.membership.findUnique = originals.membershipFindUnique;
    prisma.membership.create = originals.membershipCreate;
    prisma.refreshToken.create = originals.refreshTokenCreate;
  });

  it("audits the auto-joined membership with a verified_self_membership principal", async () => {
    prisma.user.findUnique = mock.fn(async () => null) as never;
    prisma.user.create = mock.fn(async () => ({
      id: "user-new", email: "new@example.test", passwordHash: "h", name: null,
      createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
    })) as never;
    prisma.org.findUnique = mock.fn(async () => ({
      id: "org-a", name: "Fixture", slug: "fixture", autoJoinDomain: "example.test",
      createdAt: new Date(), updatedAt: new Date(),
    })) as never;
    prisma.membership.findUnique = mock.fn(async () => null) as never;
    prisma.membership.create = mock.fn(async () => ({
      id: "m-1", userId: "user-new", orgId: "org-a", role: "MEMBER", status: "ACTIVE",
      createdAt: new Date(),
    })) as never;
    prisma.refreshToken.create = mock.fn(async () => ({
      id: "rt-1", userId: "user-new", tokenHash: "h", expiresAt: new Date(),
      revokedAt: null, createdAt: new Date(),
    })) as never;

    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction } as unknown as AuditService;
    const billing = {
      assertSeatAvailable: mock.fn(async () => undefined),
      syncSeats: mock.fn(async () => undefined),
    } as unknown as BillingService;

    const service = new AuthService(fakeJwt(), audit, billing);
    await service.register("new@example.test", "password123!");

    assert.equal(logAction.mock.callCount(), 1);
    const call = logAction.mock.calls[0]!.arguments[0] as {
      action: string; targetType: string; targetId: string;
      principal: { kind: string; organizationId?: string; userId?: string };
    };
    assert.equal(call.action, "membership.created");
    assert.equal(call.targetType, "Membership");
    assert.equal(call.targetId, "m-1");
    assert.deepEqual(
      call.principal,
      mintVerifiedSelfMembershipPrincipal({ userId: "user-new", orgId: "org-a" }),
    );
  });

  it("does not audit anything when there is no matching auto-join domain", async () => {
    prisma.user.findUnique = mock.fn(async () => null) as never;
    prisma.user.create = mock.fn(async () => ({
      id: "user-new", email: "new@other.test", passwordHash: "h", name: null,
      createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null,
    })) as never;
    prisma.org.findUnique = mock.fn(async () => null) as never;
    prisma.refreshToken.create = mock.fn(async () => ({
      id: "rt-1", userId: "user-new", tokenHash: "h", expiresAt: new Date(),
      revokedAt: null, createdAt: new Date(),
    })) as never;

    const logAction = mock.fn(async (input: unknown) => input);
    const audit = { logAction } as unknown as AuditService;
    const billing = {
      assertSeatAvailable: mock.fn(async () => undefined),
      syncSeats: mock.fn(async () => undefined),
    } as unknown as BillingService;

    const service = new AuthService(fakeJwt(), audit, billing);
    await service.register("new@other.test", "password123!");
    assert.equal(logAction.mock.callCount(), 0);
  });
});
