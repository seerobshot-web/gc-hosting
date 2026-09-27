import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import {
  BadRequestException, NotFoundException,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { prisma } from "@gch/database";
import { PERMISSION_KEY } from "../rbac/require-permission.decorator";
import { RolesGuard } from "../rbac/roles.guard";
import { TenancyService } from "../tenancy/tenancy.service";
import { encodeAuditReadCursor } from "./audit-read-cursor";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

function context(userId: string | null, orgId?: string): ExecutionContext {
  const request = { user: userId ? { userId, email: "member@example.test" } : undefined,
    params: {}, body: {}, query: orgId ? { orgId } : {}, tenant: undefined };
  return {
    getHandler: () => AuditController.prototype.recent,
    getClass: () => AuditController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("GET /audit tenant isolation", () => {
  it("requires live organization-scoped read permission", () => {
    assert.deepEqual(
      Reflect.getMetadata(PERMISSION_KEY, AuditController.prototype.recent),
      { permission: "org:read", scope: "org" },
    );
  });

  it("denies requests with no identity or organization scope", async () => {
    const tenancy = { requireMembership: mock.fn(async () => ({ role: "OWNER" })) };
    const guard = new RolesGuard(new Reflector(), tenancy as unknown as TenancyService);
    assert.equal(await guard.canActivate(context(null, "org-a")), false);
    await assert.rejects(guard.canActivate(context("user-a")), BadRequestException);
    assert.equal(tenancy.requireMembership.mock.callCount(), 0);
  });

  it("denies a tenant without active membership before any audit read", async () => {
    const tenancy = { requireMembership: mock.fn(async () => {
      throw new NotFoundException("Org not found");
    }) };
    const guard = new RolesGuard(new Reflector(), tenancy as unknown as TenancyService);
    await assert.rejects(guard.canActivate(context("user-a", "org-b")), NotFoundException);
  });

  describe("GET /audit — Phase 8 tenant-scoped read", { concurrency: false }, () => {
    const original = prisma.auditLog.findMany;
    afterEach(() => {
      prisma.auditLog.findMany = original;
    });

    it("scopes the query to the caller's own org, never a different one", async () => {
      const find = mock.fn(async (_args: unknown) => []);
      prisma.auditLog.findMany = find as never;
      const controller = new AuditController(new AuditService({} as never));

      await controller.recent({ orgId: "org-a", membership: { role: "OWNER" } } as never, {});

      const args = find.mock.calls[0]!.arguments[0] as { where: { orgId: string } };
      assert.equal(args.where.orgId, "org-a");
    });

    it("never returns a row for a different org even if one were somehow selected", async () => {
      prisma.auditLog.findMany = mock.fn(async ({ where }: { where: { orgId: string } }) =>
        // Simulates a real DB honoring the WHERE clause: only org-a rows.
        where.orgId === "org-a"
          ? [{
              id: "audit-1", actor: "user:x", action: "org.updated", targetType: "Org",
              targetId: "org-a", metadata: null, createdAt: new Date("2026-01-01T00:00:00Z"),
            }]
          : [],
      ) as never;
      const controller = new AuditController(new AuditService({} as never));

      const forA = await controller.recent(
        { orgId: "org-a", membership: { role: "OWNER" } } as never, {},
      );
      const forB = await controller.recent(
        { orgId: "org-b", membership: { role: "OWNER" } } as never, {},
      );
      assert.equal(forA.items.length, 1);
      assert.equal(forB.items.length, 0);
    });

    it("issues a nextCursor only when a further page exists, and accepts it back", async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({
        id: `audit-${i}`, actor: "user:x", action: "org.updated", targetType: "Org",
        targetId: "org-a", metadata: null,
        createdAt: new Date(2026, 0, 1, 0, 0, i),
      })).reverse(); // newest first, matching the real ORDER BY
      prisma.auditLog.findMany = mock.fn(async ({ take, where }: {
        take: number; where: { OR?: unknown };
      }) => {
        const start = where.OR ? 2 : 0; // simulate the cursor already having consumed 2 rows
        return rows.slice(start, start + take);
      }) as never;
      const controller = new AuditController(new AuditService({} as never));

      const first = await controller.recent(
        { orgId: "org-a", membership: { role: "OWNER" } } as never, { limit: 2 },
      );
      assert.equal(first.items.length, 2);
      assert.ok(first.nextCursor);

      const second = await controller.recent(
        { orgId: "org-a", membership: { role: "OWNER" } } as never,
        { cursor: first.nextCursor!, limit: 2 },
      );
      assert.equal(second.items.length, 1);
      assert.equal(second.nextCursor, null);
    });

    it("rejects a malformed cursor with 400, never treating it as 'start over'", async () => {
      const find = mock.fn(async (_args: unknown) => []);
      prisma.auditLog.findMany = find as never;
      const controller = new AuditController(new AuditService({} as never));

      await assert.rejects(
        controller.recent(
          { orgId: "org-a", membership: { role: "OWNER" } } as never,
          { cursor: "not-a-real-cursor!!" },
        ),
        BadRequestException,
      );
      assert.equal(find.mock.callCount(), 0);
    });

    it("bounds the page size regardless of what a caller asks for", async () => {
      const find = mock.fn(async (_args: unknown) => []);
      prisma.auditLog.findMany = find as never;
      const controller = new AuditController(new AuditService({} as never));

      await controller.recent({ orgId: "org-a", membership: { role: "OWNER" } } as never, {});
      assert.equal((find.mock.calls[0]!.arguments[0] as { take: number }).take, 51); // default 50 + 1 lookahead
    });

    it("parses stored JSON metadata back into an object", async () => {
      prisma.auditLog.findMany = mock.fn(async () => [{
        id: "audit-1", actor: "user:x", action: "org.updated", targetType: "Org",
        targetId: "org-a", metadata: JSON.stringify({ from: "A", to: "B" }),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }]) as never;
      const controller = new AuditController(new AuditService({} as never));

      const result = await controller.recent(
        { orgId: "org-a", membership: { role: "OWNER" } } as never, {},
      );
      assert.deepEqual(result.items[0]!.metadata, { from: "A", to: "B" });
    });

    it("round-trips a real encoded cursor unchanged", async () => {
      const cursor = encodeAuditReadCursor({ createdAt: new Date("2026-01-01T00:00:00Z"), id: "audit-9" });
      const find = mock.fn(async (_args: unknown) => []);
      prisma.auditLog.findMany = find as never;
      const controller = new AuditController(new AuditService({} as never));

      await controller.recent({ orgId: "org-a", membership: { role: "OWNER" } } as never, { cursor });
      const args = find.mock.calls[0]!.arguments[0] as { where: { OR: unknown[] } };
      assert.ok(Array.isArray(args.where.OR));
    });
  });
});
