/**
 * Audit integrity check for deployed legacy ProvisioningOrders.
 *
 * Each invocation checks at most 1,000 orders. An incomplete run exits
 * nonzero so it cannot be mistaken for a clean full-table reconciliation.
 * Only aggregate counts are logged; no target identifiers or raw errors.
 */
import { prisma } from "@gch/database";
import { scanAuditIntegrity } from "./audit-integrity-scan";

async function main() {
  const result = await scanAuditIntegrity({
    listDeployed: (afterId, limit) =>
      prisma.provisioningOrder.findMany({
        where: {
          status: "deployed",
          ...(afterId === undefined ? {} : { id: { gt: afterId } }),
        },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true },
      }),
    hasDeploymentAudit: async (orderId) =>
      (await prisma.auditLog.findFirst({
        where: {
          action: "order.deployed",
          targetType: "ProvisioningOrder",
          targetId: orderId,
        },
        select: { id: true },
      })) !== null,
  });

  const level = result.incomplete || result.missingAudit > 0 ? "warn" : "log";
  console[level](
    `[audit-integrity-check] examined=${result.examined} missingAudit=${result.missingAudit} incomplete=${result.incomplete}`,
  );
  if (result.incomplete) process.exitCode = 2;
}

main()
  .catch(() => {
    console.error("[audit-integrity-check] failed; result unavailable");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
