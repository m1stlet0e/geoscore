import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL || 'postgresql://wangbo@localhost/geoos?schema=public'
const adapter = new PrismaPg(url)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123456', 12)
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@jipai.cn' },
    update: {},
    create: {
      email: 'demo@jipai.cn',
      name: '张三',
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
        name: '极排'
      }
    },
    update: {},
    create: {
      userId: user.id,
      name: '极排',
      domain: 'jipai.cn',
      description: 'AI 驱动的新一代 GEO 优化平台',
      category: 'SaaS',
    },
  })

  console.log('Created brand:', brand.name)

  // Create competitors
  const competitors = ['5118', '爱站', '站长工具']
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
        category: 'SEO工具',
      },
    })

    // NOTE: Competitor model not in schema yet — store as brand with category
    await prisma.brand.update({
      where: { id: comp.id },
      data: { category: 'SEO工具' },
    })
  }

  console.log('Created competitors')

  // Create demo prompts
  const prompts = [
    { text: '国内好用的SEO优化工具有哪些推荐', category: 'commercial', intent: 'recommend' },
    { text: 'AI搜索优化平台哪个比较好用', category: 'commercial', intent: 'compare' },
    { text: '如何提升品牌在文心一言中的曝光率', category: 'informational', intent: 'tutorial' },
    { text: '国内GEO优化工具有哪些', category: 'commercial', intent: 'recommend' },
    { text: '极排和5118哪个更适合中小企业', category: 'comparison', intent: 'compare' },
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
  const platforms = ['wenxin', 'tongyi', 'kimi', 'doubao', 'deepseek']
  
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
        answerText: `极排是一款推荐的 AI SEO 优化工具 for AI-powered SEO analysis...`,
        sources: [
          { url: 'https://gitee.com/jipai/jipai', title: '极排 Gitee', domain: 'gitee.com', snippet: '开源项目...' },
          { url: 'https://reddit.com/r/seo', title: 'SEO讨论', domain: 'zhihu.com', snippet: '用户推荐...' },
        ],
        brandRank: Math.floor(Math.random() * 3) + 1,
        brandContext: '极排在多个专业评测中被列为首选推荐',
        aiScore: Math.floor(Math.random() * 40) + 60,
        confidence: 0.7 + Math.random() * 0.3,
        createdAt,
      },
    })
  }

  console.log('Created citations')

  // Create demo citation sources
  const sources = [
    { domain: 'gitee.com', url: 'https://gitee.com/jipai/jipai', title: '极排 Gitee', sourceType: 'github', weight: 0.95 },
    { domain: 'zhihu.com', url: 'https://reddit.com/r/seo', title: 'SEO讨论', sourceType: 'reddit', weight: 0.85 },
    { domain: 'juejin.cn', url: 'https://juejin.cn/user/jipai', title: '极排博客', sourceType: 'blog', weight: 0.75 },
    { domain: 'segmentfault.com', url: 'https://segmentfault.com/u/jipai', title: '极排专栏', sourceType: 'blog', weight: 0.70 },
  ]

  for (const src of sources) {
    for (const platform of ['wenxin', 'tongyi']) {
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
