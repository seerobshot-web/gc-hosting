/**
 * Idempotent development seed.
 *
 * Creates the minimum fixtures needed to exercise the portal locally:
 *   - one test Org
 *   - one test User, linked to that Org via an OWNER Membership
 *   - one test Plan
 *
 * Every write is an upsert keyed on a natural unique field, so running the
 * seed repeatedly converges to the same state without creating duplicates.
 *
 * Run: DATABASE_URL=... pnpm --filter @gch/database exec prisma db seed
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.upsert({
    where: { slug: "test-org" },
    create: { name: "Test Org", slug: "test-org" },
    update: { name: "Test Org" },
  });

  const user = await prisma.user.upsert({
    where: { email: "owner@test.local" },
    create: { email: "owner@test.local", name: "Test Owner" },
    update: { name: "Test Owner" },
  });

  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    create: { userId: user.id, orgId: org.id, role: Role.OWNER },
    update: { role: Role.OWNER },
  });

  const plan = await prisma.plan.upsert({
    where: { stripePriceId: "price_test_team" },
    create: {
      stripePriceId: "price_test_team",
      name: "Test Team",
      pricePerSeatCents: 900,
      seatLimit: 10,
      isActive: true,
    },
    update: { name: "Test Team", pricePerSeatCents: 900, seatLimit: 10 },
  });

  console.log(
    `Seeded: org=${org.id} user=${user.id} (OWNER of ${org.slug}) plan=${plan.id}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
