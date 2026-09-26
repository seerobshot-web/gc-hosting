import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { describe, it, mock } from "node:test";
import type { Membership } from "@gch/database";
import type { TenantContext } from "../rbac/tenant.decorator";
import { BillingService } from "./billing.service";

function makeTenant(): TenantContext {
  return {
    orgId: "org-1",
    membership: { userId: "user-1" } as Membership,
  };
}

describe("BillingService.createProductCheckoutSession", () => {
  it("fails closed before calling Stripe when the server-side mapping is incomplete", async () => {
    const stripe = {
      createCheckoutSession: mock.fn(async () => ({
        id: "cs_1",
        url: "https://checkout.stripe.test/session/cs_1",
        customerId: "cus_1",
      })),
    };
    const audit = { logAction: mock.fn(async () => undefined) };
    const service = new BillingService(stripe as never, audit as never);

    await assert.rejects(
      service.createProductCheckoutSession(makeTenant(), {
        gchSlug: "web-hosting",
        billingCycle: "monthly",
      }),
      (error: unknown) =>
        error instanceof ConflictException &&
        String((error.getResponse() as { message?: string }).message).includes(
          "pending contract verification",
        ),
    );

    assert.equal(stripe.createCheckoutSession.mock.callCount(), 0);
    assert.equal(audit.logAction.mock.callCount(), 0);
  });
});
