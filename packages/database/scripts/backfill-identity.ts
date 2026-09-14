/**
 * One-off Stage 1 backfill: give every pre-identity Client a portal User and
 * an OWNER Membership in its Org. Idempotent — safe to re-run until
 * `Client.userId IS NULL` reports zero, at which point the column can be
 * flipped to required in a follow-up migration.
 *
 * Run: DATABASE_URL=... pnpm --filter @gch/database backfill:identity
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({ where: { userId: null } });
  console.log(`Clients without a User: ${clients.length}`);

  let usersCreated = 0;
  let membershipsCreated = 0;

  for (const client of clients) {
    const email = client.email.trim().toLowerCase();

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email } });
      usersCreated += 1;
    }

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: client.orgId } },
    });
    if (!membership) {
      await prisma.membership.create({
        data: { userId: user.id, orgId: client.orgId, role: Role.OWNER },
      });
      membershipsCreated += 1;
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { userId: user.id },
    });
  }

  const remaining = await prisma.client.count({ where: { userId: null } });
  console.log(
    `Users created: ${usersCreated}, memberships created: ${membershipsCreated}, ` +
      `Clients still unlinked: ${remaining}`,
  );
  if (remaining > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
