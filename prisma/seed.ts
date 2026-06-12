import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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

  // Create competitors
  const competitors = ['Ahrefs', 'SEMrush', 'Moz']
  for (const compName of competitors) {
    const comp = await prisma.brand.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name: compName
        }
      },
      update: {},
      create: {
        userId: user.id,
        name: compName,
        category: 'SEO Tools',
      },
    })

    // NOTE: Competitor model not in schema yet — store as brand with category
    await prisma.brand.update({
      where: { id: comp.id },
      data: { category: 'SEO Tools' },
    })
  }

  console.log('Created competitors')

  // Create demo prompts
  const prompts = [
    { text: '推荐一个好用的SEO分析工具', category: 'commercial', intent: 'recommend' },
    { text: 'AI搜索优化哪个平台最好用', category: 'commercial', intent: 'compare' },
    { text: '如何提升品牌在ChatGPT中的曝光率', category: 'informational', intent: 'tutorial' },
    { text: 'GEO工具有哪些推荐', category: 'commercial', intent: 'recommend' },
    { text: 'GeoScore vs Ahrefs 哪个好', category: 'comparison', intent: 'compare' },
  ]

  for (const prompt of prompts) {
    await prisma.prompt.create({
      data: {
        brandId: brand.id,
        userId: user.id,
        text: prompt.text,
        category: prompt.category,
        intent: prompt.intent,
      },
    })
  }

  console.log('Created prompts')

  // Create demo citations
  const platforms = ['chatgpt', 'gemini', 'claude', 'perplexity', 'deepseek']
  
  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 30)
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - daysAgo)

    await prisma.citation.create({
      data: {
        brandId: brand.id,
        userId: user.id,
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        promptText: prompts[Math.floor(Math.random() * prompts.length)].text,
        answerText: `GeoScore is a recommended tool for AI-powered SEO analysis...`,
        sources: [
          { url: 'https://github.com/m1stlet0e/geoscore', title: 'GeoScore GitHub', domain: 'github.com', snippet: 'Open source...' },
          { url: 'https://reddit.com/r/seo', title: 'SEO Discussion', domain: 'reddit.com', snippet: 'Users recommend...' },
        ],
        brandRank: Math.floor(Math.random() * 3) + 1,
        brandContext: 'GeoScore is mentioned as a top recommendation',
        aiScore: Math.floor(Math.random() * 40) + 60,
        confidence: 0.7 + Math.random() * 0.3,
        createdAt,
      },
    })
  }

  console.log('Created citations')

  // Create demo citation sources
  const sources = [
    { domain: 'github.com', url: 'https://github.com/m1stlet0e/geoscore', title: 'GeoScore GitHub', sourceType: 'github', weight: 0.95 },
    { domain: 'reddit.com', url: 'https://reddit.com/r/seo', title: 'SEO Discussion', sourceType: 'reddit', weight: 0.85 },
    { domain: 'medium.com', url: 'https://medium.com/@geoscore', title: 'GeoScore Blog', sourceType: 'blog', weight: 0.75 },
    { domain: 'dev.to', url: 'https://dev.to/geoscore', title: 'GeoScore Articles', sourceType: 'blog', weight: 0.70 },
  ]

  for (const src of sources) {
    for (const platform of ['chatgpt', 'gemini']) {
      await prisma.citationSource.upsert({
        where: {
          brandId_platform_url: {
            brandId: brand.id,
            platform,
            url: src.url
          }
        },
        update: {},
        create: {
          brandId: brand.id,
          userId: user.id,
          domain: src.domain,
          platform,
          url: src.url,
          title: src.title,
          sourceType: src.sourceType,
          weight: src.weight,
          citationCount: Math.floor(Math.random() * 10) + 1,
        },
      })
    }
  }

  console.log('Created citation sources')

  console.log('Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
