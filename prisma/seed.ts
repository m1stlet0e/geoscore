import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PLAN_CATALOG, PLAN_CODES } from "../src/lib/plans";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("缺少 DATABASE_URL");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  for (const code of PLAN_CODES) {
    const plan = PLAN_CATALOG[code];
    await db.plan.upsert({
      where: { code },
      update: {
        name: plan.name,
        priceCents: plan.priceCents,
        monthlyResponses: plan.monthlyResponses,
        maxBrands: plan.maxBrands,
        active: true,
      },
      create: {
        code,
        name: plan.name,
        priceCents: plan.priceCents,
        monthlyResponses: plan.monthlyResponses,
        maxBrands: plan.maxBrands,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
