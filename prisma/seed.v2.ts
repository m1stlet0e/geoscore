/**
 * v2 seed — populates v2 tables from industry configs.
 *
 * Idempotent: safe to re-run. Uses upserts on natural keys.
 *
 * Run with: npm run db:seed:v2
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { industries } from '../src/lib/v2/industries'

const url = process.env.DATABASE_URL || 'postgresql://wangbo@localhost/geoos?schema=public'
const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function seedIndustry(industrySlug: string) {
  const cfg = industries[industrySlug]
  if (!cfg) throw new Error(`Unknown industry: ${industrySlug}`)

  console.log(`\n[${cfg.industry}] ${cfg.label}`)

  // 1. Brand nodes
  let brandCount = 0
  for (const brand of cfg.brands) {
    await prisma.v2CitationNode.upsert({
      where: {
        kind_industry_name: {
          kind: 'brand',
          industry: cfg.industry,
          name: brand.name,
        },
      },
      update: {
        aliases: brand.aliases,
        meta: { homepage: brand.homepage, github: brand.github },
      },
      create: {
        kind: 'brand',
        industry: cfg.industry,
        name: brand.name,
        aliases: brand.aliases,
        meta: { homepage: brand.homepage, github: brand.github },
      },
    })
    brandCount++
  }
  console.log(`  brands:  ${brandCount} upserted`)

  // 2. Prompts
  let promptCount = 0
  for (const p of cfg.prompts) {
    await prisma.v2PromptLibrary.upsert({
      where: {
        industry_text: {
          industry: cfg.industry,
          text: p.text,
        },
      },
      update: {
        category: p.category ?? null,
        language: p.language ?? 'zh',
      },
      create: {
        industry: cfg.industry,
        text: p.text,
        category: p.category ?? null,
        language: p.language ?? 'zh',
        source: 'seed',
      },
    })
    promptCount++
  }
  console.log(`  prompts: ${promptCount} upserted`)
}

async function main() {
  console.log('Seeding v2 tables...')
  for (const slug of Object.keys(industries)) {
    await seedIndustry(slug)
  }
  console.log('\n✓ v2 seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
