import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL || 'postgresql://wangbo@localhost/geoos?schema=public'
const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123456', 12)
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@geoos.ai' },
    update: {},
    create: {
      email: 'demo@geoos.ai',
      name: '王老板',
      passwordHash,
      plan: 'PRO',
    },
  })

  console.log('Created user:', user.email)

  // Create demo brand
  const brand = await prisma.brand.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'GeoScore'
      }
    },
    update: {},
    create: {
      userId: user.id,
      name: 'GeoScore',
      domain: 'geoscore.ai',
      description: 'AI-powered SEO analysis platform',
      category: 'SaaS',
    },
  })

  console.log('Created brand:', brand.name)
  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
