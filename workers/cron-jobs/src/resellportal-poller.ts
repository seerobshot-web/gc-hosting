/**
 * Cron job 1/3: ResellPortal status poller.
 *
 * Runnable standalone via Hostinger's cron interface (`tsx
 * src/resellportal-poller.ts`) with no running server process required —
 * that's why this duplicates the small ResellPortal fetch call that also
 * lives in apps/api's ResellPortalClient, rather than importing it: pulling
 * in NestJS's DI container for a one-shot CLI script would be the wrong
 * trade. Keep the two in sync if the ResellPortal contract changes.
 *
 * Sweeps every ProvisioningOrder still in "installing"/"provisioning"
 * state, checks GET /services, updates the DB, and triggers the
 * welcome-email flow once deployment_status flips to "deployed" — the same
 * poll pattern described in the architecture doc, run here as a
 * belt-and-suspenders sweep in addition to the API's own @Cron poller.
 */
import { prisma } from "@gch/database";

const RESELLPORTAL_BASE_URL = "https://panel.resellportal.com/wp-json/resellportal/v1";

interface ResellPortalService {
  id: string;
  deployment_status: string;
  next_billing_date: string | null;
}

async function getServices(fossbillingClientId: string): Promise<ResellPortalService[]> {
  const apiKey = process.env.RESELLPORTAL_API_KEY;
  if (!apiKey) {
    throw new Error("RESELLPORTAL_API_KEY is not set");
  }

  const res = await fetch(
    `${RESELLPORTAL_BASE_URL}/services?client_id=${encodeURIComponent(fossbillingClientId)}`,
    { headers: { "X-API-Key": apiKey } },
  );

  if (!res.ok) {
    throw new Error(`ResellPortal /services failed: ${res.status}`);
  }

  return res.json();
}

async function triggerWelcomeEmail(clientId: string, primaryDomain: string) {
  // Integration point: wire to whatever transactional-email provider GCH
  // settles on. Logging for now so the poller is fully runnable/testable
  // before that provider is chosen.
  console.log(`[welcome-email] would send for client=${clientId} domain=${primaryDomain}`);
}

async function main() {
  const pending = await prisma.provisioningOrder.findMany({
    where: { status: "provisioning" },
  });

  console.log(`[resellportal-poller] checking ${pending.length} pending order(s)`);

  for (const order of pending) {
    const client = await prisma.client.findUnique({ where: { id: order.clientId } });
    if (!client) continue;

    try {
      const services = await getServices(client.fossbillingClientId);
      const match = services.find((s) => s.id === order.resellPortalOrderId);
      if (!match) continue;

      if (match.deployment_status === "deployed") {
        await prisma.provisioningOrder.update({
          where: { id: order.id },
          data: {
            status: "deployed",
            nextBillingDate: match.next_billing_date ? new Date(match.next_billing_date) : null,
          },
        });
        await triggerWelcomeEmail(order.clientId, order.primaryDomain);
        console.log(`[resellportal-poller] order ${order.id} -> deployed`);
      }
    } catch (err) {
      console.error(`[resellportal-poller] order ${order.id} failed:`, err);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
