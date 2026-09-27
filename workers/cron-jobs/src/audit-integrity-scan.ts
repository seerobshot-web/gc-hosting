/**
 * Bounded read-only check for deployed legacy orders with missing audit events.
 * A capped run is explicitly incomplete; no record identifiers leave this module.
 */
export const AUDIT_INTEGRITY_BATCH_SIZE = 100;
export const AUDIT_INTEGRITY_MAX_ORDERS = 1_000;

export interface AuditIntegrityReader {
  listDeployed(afterId: string | undefined, limit: number): Promise<readonly { id: string }[]>;
  hasDeploymentAudit(orderId: string): Promise<boolean>;
}

export interface AuditIntegritySummary {
  examined: number;
  missingAudit: number;
  incomplete: boolean;
}

export async function scanAuditIntegrity(
  reader: AuditIntegrityReader,
): Promise<AuditIntegritySummary> {
  let afterId: string | undefined;
  let examined = 0;
  let missingAudit = 0;

  while (examined < AUDIT_INTEGRITY_MAX_ORDERS) {
    const limit = Math.min(AUDIT_INTEGRITY_BATCH_SIZE, AUDIT_INTEGRITY_MAX_ORDERS - examined);
    const orders = await reader.listDeployed(afterId, limit);
    if (orders.length > limit) throw new Error("audit_integrity_invalid_batch");

    for (const order of orders) {
      // A non-advancing cursor could repeat records or hide incomplete coverage.
      if (!order.id || (afterId !== undefined && order.id <= afterId)) {
        throw new Error("audit_integrity_invalid_cursor");
      }
      if (!(await reader.hasDeploymentAudit(order.id))) missingAudit++;
      afterId = order.id;
      examined++;
    }

    if (orders.length < limit) return { examined, missingAudit, incomplete: false };
  }

  // At most one additional read establishes whether the capped run was complete.
  const hasMore = (await reader.listDeployed(afterId, 1)).length > 0;
  return { examined, missingAudit, incomplete: hasMore };
}
