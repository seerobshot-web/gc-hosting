/**
 * Cron job 3/3: audit log integrity check.
 *
 * Useful once the Agent Plan (GCH Aleph) starts writing to AuditLog for
 * every automated action — this sanity-checks that the write pattern is
 * actually being followed, not just that the table exists.
 *
 * Concretely: every ProvisioningOrder that reached "deployed" status
 * should have a matching AuditLog row (action = "order.deployed",
 * targetId = order.id). A deployed order with no such row means something
 * wrote to ProvisioningOrder without going through AuditService — the
 * class of gap this script exists to catch.
 */
import { prisma } from "@gch/database";

async function main() {
  const deployedOrders = await prisma.provisioningOrder.findMany({
    where: { status: "deployed" },
    select: { id: true },
  });

  const gaps: string[] = [];

  for (const order of deployedOrders) {
    const match = await prisma.auditLog.findFirst({
      where: {
        action: "order.deployed",
        targetType: "ProvisioningOrder",
        targetId: order.id,
      },
    });
    if (!match) {
      gaps.push(order.id);
    }
  }

  if (gaps.length > 0) {
    console.warn(
      `[audit-integrity-check] ${gaps.length} deployed ProvisioningOrder(s) with no matching AuditLog entry:`,
      gaps,
    );
  } else {
    console.log(
      `[audit-integrity-check] all ${deployedOrders.length} deployed order(s) have a matching audit entry`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
