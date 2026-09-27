import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  BadRequestException, NotFoundException, ServiceUnavailableException,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { prisma } from "@gch/database";
import { PERMISSION_KEY } from "../rbac/require-permission.decorator";
import { RolesGuard } from "../rbac/roles.guard";
import { TenancyService } from "../tenancy/tenancy.service";
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

  it("refuses even an authorized tenant because existing rows have no orgId", async () => {
    const find = mock.fn(async (_args: unknown) => []);
    const original = prisma.auditLog.findMany;
    prisma.auditLog.findMany = find as never;
    try {
      const service = new AuditService();
      const controller = new AuditController(service);
      for (const orgId of ["org-a", "org-b"]) {
        await assert.rejects(async () => controller.recent({
          orgId, membership: { role: "OWNER" },
        } as never), (error: unknown) =>
          error instanceof ServiceUnavailableException
          && error.message === "Tenant-scoped audit history is unavailable");
      }
      assert.equal(find.mock.callCount(), 0);
    } finally {
      prisma.auditLog.findMany = original;
    }
  });
});
