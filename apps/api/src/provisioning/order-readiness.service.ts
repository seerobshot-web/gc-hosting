import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@gch/database";
import { assessEntitlementReadiness, unconfiguredObservations } from "./phase3-contract-boundaries";

/**
 * Read-only projection. The local Order status is informational and cannot
 * certify payment, fulfillment, product eligibility, or an entitlement.
 */
@Injectable()
export class OrderReadinessService {
  async findForOrg(orderId: string, orgId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId },
      select: { id: true, orgId: true, status: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const observations = unconfiguredObservations(order.id, order.orgId);
    return {
      orderId: order.id,
      status: "blocked" as const,
      localOrderStatus: order.status,
      paymentVerified: false,
      fulfillmentVerified: false,
      ...assessEntitlementReadiness(
        order.id, order.orgId,
        observations.product, observations.payment, observations.fulfillment,
      ),
    };
  }
}
