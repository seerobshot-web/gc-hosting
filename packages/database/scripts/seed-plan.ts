/**
 * Registers (or updates) a Plan row for an existing Stripe Price. Plans are
 * created in the Stripe dashboard; this just tells the portal about one.
 *
 * Run: DATABASE_URL=... pnpm --filter @gch/database seed:plan -- \
 *        --price price_123 --name "Team" --per-seat 900 [--seat-limit 10]
 */
import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  // pnpm forwards the "--" separator itself; parseArgs would treat
  // everything after it as positional.
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: {
    price: { type: "string" },
    name: { type: "string" },
    "per-seat": { type: "string" },
    "seat-limit": { type: "string" },
  },
});

if (!values.price || !values.name || !values["per-seat"]) {
  console.error("Usage: --price <stripePriceId> --name <name> --per-seat <cents> [--seat-limit <n>]");
  process.exit(1);
}

const prisma = new PrismaClient();
const data = {
  name: values.name,
  pricePerSeatCents: Number(values["per-seat"]),
  seatLimit: values["seat-limit"] ? Number(values["seat-limit"]) : null,
  isActive: true,
};

prisma.plan
  .upsert({
    where: { stripePriceId: values.price },
    create: { stripePriceId: values.price, ...data },
    update: data,
  })
  .then((plan) => console.log(`Plan ${plan.id}: ${plan.name} (${plan.stripePriceId})`))
  .finally(() => prisma.$disconnect());
