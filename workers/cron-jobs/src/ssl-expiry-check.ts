/**
 * Cron job 2/3: SSL expiry check.
 *
 * Genuinely functional (not a stub): opens a real TLS connection to each
 * domain on file and reads the certificate's actual notAfter date, rather
 * than assuming a data source that doesn't exist yet. Flags anything
 * within WARN_DAYS of expiry.
 */
import { connect } from "node:tls";
import { prisma } from "@gch/database";

const WARN_DAYS = 14;

function getCertExpiry(hostname: string): Promise<Date> {
  return new Promise((resolve, reject) => {
    const socket = connect(
      { host: hostname, port: 443, servername: hostname, timeout: 8000 },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          reject(new Error(`No certificate returned for ${hostname}`));
          return;
        }
        resolve(new Date(cert.valid_to));
      },
    );
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`TLS connection to ${hostname} timed out`));
    });
  });
}

async function main() {
  const orders = (await prisma.provisioningOrder.findMany({
    where: { status: "deployed" },
    select: { primaryDomain: true, clientId: true },
  })) as Array<{ primaryDomain: string; clientId: string }>;

  const domains = [...new Set(orders.map((o) => o.primaryDomain))];
  console.log(`[ssl-expiry-check] checking ${domains.length} domain(s)`);

  const flagged: Array<{ domain: string; daysRemaining: number }> = [];

  for (const domain of domains) {
    try {
      const expiry = await getCertExpiry(domain);
      const daysRemaining = Math.floor((expiry.getTime() - Date.now()) / 86_400_000);
      if (daysRemaining <= WARN_DAYS) {
        flagged.push({ domain, daysRemaining });
      }
    } catch (err) {
      console.error(`[ssl-expiry-check] ${domain} check failed:`, err);
    }
  }

  if (flagged.length > 0) {
    console.warn("[ssl-expiry-check] certs nearing renewal:", flagged);
    // Integration point: route `flagged` to whichever alert channel GCH
    // operators actually watch (email/Slack/etc).
  } else {
    console.log("[ssl-expiry-check] no certs within warning window");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
