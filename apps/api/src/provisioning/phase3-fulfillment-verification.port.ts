import { Injectable, Logger } from "@nestjs/common";
import { prisma } from "@gch/database";
import { ResellPortalClient } from "./resellportal.client";
import type { FulfillmentObservation, FulfillmentVerificationPort } from "./phase3-contract-boundaries";

/**
 * Real ResellPortal-backed implementation of FulfillmentVerificationPort
 * (Phase 11), using the already-existing ResellPortalClient — no new HTTP
 * call shape is invented here.
 *
 * This answers exactly one question — "does ResellPortal itself currently
 * report this order's provisioned service as active?" — via a fresh
 * server-side call. It never authorizes a purchase and is not wired into
 * any route or into assessPurchaseGate; phase3PurchaseEnabled and
 * phase3Evidence are untouched, so nothing this port observes can make a
 * purchase possible on its own. The LOCAL ProviderService.status is used
 * only to find which provider-side service to ask about — never as the
 * verification itself (that would be exactly the "local flag as authority"
 * pattern this whole phase exists to avoid).
 *
 * KNOWN CONTRACT GAP, stated explicitly rather than papered over: the
 * lifecycle endpoints' `status` field (`providerServiceSchema` in
 * resellportal.client.ts) is typed as a bare `z.string()` — no official
 * ResellPortal documentation or fixture in this repository confirms what
 * string values it actually returns for an active service. This port
 * treats an exact, case-insensitive match against the literal `"active"`
 * as the verified state, matching the one analogous precedent already in
 * this codebase (`resellportal-poller.ts`'s `deployment_status ===
 * "deployed"` check on the separate legacy /services schema) and the
 * fixture default in `__fixtures__/resellportal-contract.fixtures.ts`
 * (`rawStatus: "active"`). This is a tracked ASSUMPTION, not a verified
 * fact — closing it needs the same official contract evidence every other
 * ResellPortal gap in this repository is waiting on.
 */
@Injectable()
export class Phase3ResellPortalFulfillmentVerificationPort implements FulfillmentVerificationPort {
  private readonly logger = new Logger(Phase3ResellPortalFulfillmentVerificationPort.name);

  constructor(private readonly resellPortal: ResellPortalClient) {}

  async verify(orderId: string, orgId: string): Promise<FulfillmentObservation> {
    const notVerified = (): FulfillmentObservation => ({
      orderId, orgId, authority: "resellportal", verified: false, evidenceRef: null,
    });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { providerService: true },
    });
    if (!order || order.orgId !== orgId) return notVerified();
    if (!order.providerService) return notVerified();

    const { id: providerServiceId, resellPortalId } = order.providerService;
    try {
      const idempotencyKey = ResellPortalClient.idempotencyKey(
        "providerService", providerServiceId, "phase3FulfillmentVerification",
      );
      const status = await this.resellPortal.getServiceStatus(resellPortalId, idempotencyKey);
      // Integrity check: the provider must echo back the exact service we
      // asked about, not merely respond with *something*.
      if (status.service_id !== resellPortalId) return notVerified();
      if (status.status.trim().toLowerCase() !== "active") return notVerified();
      return { orderId, orgId, authority: "resellportal", verified: true, evidenceRef: resellPortalId };
    } catch (err) {
      this.logger.error(
        `Phase 3 fulfillment verification failed for order ${orderId}: ${err instanceof Error ? err.message : "unknown"}`,
      );
      return notVerified();
    }
  }
}
