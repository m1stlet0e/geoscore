/**
 * 全面种子数据 — 为 demo 用户填充所有表
 * 运行: npx tsx prisma/seed.comprehensive.ts
 * 幂等设计：能 upsert 的用 upsert，批量 create 的检查数量 > 0 则跳过
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const url = process.env.DATABASE_URL || 'postgresql://wangbo@localhost/geoos?schema=public'
const adapter = new PrismaPg(url)
const prisma = new PrismaClient({ adapter })

const DEMO_EMAIL = 'demo@jipai.cn'

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (!user) throw new Error(`${DEMO_EMAIL} not found`)
  const uid = user.id
  const brand = await prisma.brand.findFirst({ where: { userId: uid } })
  if (!brand) throw new Error('Brand not found')
  const bid = brand.id

  console.log(`User: ${user.email} (${uid})`)
  console.log(`Brand: ${brand.name} (${bid})`)
  console.log(`Plan: ${user.plan}`)

  // 1. Quotas
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const quotaTypes: Array<{ type: 'SCAN' | 'PROMPT' | 'CITATION_ANALYSIS' | 'GAP_ANALYSIS' | 'CONTENT_GENERATE' | 'REPORT_GENERATE'; total: number }> = [
    { type: 'SCAN', total: 9999 },
    { type: 'PROMPT', total: 9999 },
    { type: 'CITATION_ANALYSIS', total: 9999 },
    { type: 'GAP_ANALYSIS', total: 9999 },
    { type: 'CONTENT_GENERATE', total: 9999 },
    { type: 'REPORT_GENERATE', total: 9999 },
  ]
  for (const qt of quotaTypes) {
    await prisma.quota.upsert({
      where: { userId_type_period_periodStart: { userId: uid, type: qt.type, period: 'monthly', periodStart } },
      update: {},
      create: { userId: uid, type: qt.type, total: qt.total, used: 0, remaining: qt.total, period: 'monthly', periodStart, periodEnd },
    })
  }
  console.log('Quotas: done')

  // 2. Prompts
  const promptsText = [
    '最好的SEO工具有哪些？', 'AI搜索引擎优化怎么做？', 'What are the best GEO tools in 2026?',
    '极排 vs 铂金智慧 哪个更好？', '如何提升品牌在文心一言中的可见性？',
    '生成式引擎优化(GEO)和传统SEO有什么区别？', '企业AI搜索优化平台推荐',
    '2026年AI营销趋势', 'AI搜索引擎如何影响品牌营销？',
    'Perplexity和ChatGPT哪个更值得优化？', 'DeepSeek搜索优化指南',
    '企业品牌监控工具有哪些？', 'How to rank in ChatGPT search results?',
    'AI visibility platform comparison', '品牌AI可见性监控方案',
    'GEO tools pricing 2026', 'AI时代的品牌营销策略',
    'Alternative to 铂金智慧 for AI search', 'SEO工具价格对比2026', 'AI搜索排名因素分析',
  ]
  const promptsCategories = ['recommend', 'tutorial', 'recommend', 'compare', 'tutorial', 'review',
    'recommend', 'review', 'review', 'compare', 'tutorial', 'recommend', 'tutorial', 'compare',
    'recommend', 'pricing', 'review', 'alternative', 'pricing', 'review']

  let existingPrompts = await prisma.prompt.count({ where: { brandId: bid } })
  let prompts = existingPrompts > 0
    ? await prisma.prompt.findMany({ where: { brandId: bid }, select: { id: true, text: true } })
    : []

  if (existingPrompts === 0) {
    for (let i = 0; i < promptsText.length; i++) {
      const p = await prisma.prompt.create({
        data: { text: promptsText[i], category: promptsCategories[i], brandId: bid, userId: uid },
        select: { id: true, text: true },
      })
      prompts.push(p)
    }
    console.log(`Prompts: ${prompts.length} created`)
  } else {
    console.log(`Prompts: ${existingPrompts} existed`)
  }

  // 3. Citations
  const existingCits = await prisma.citation.count({ where: { userId: uid } })
  if (existingCits === 0) {
    const platforms = ['deepseek', 'tongyi', 'kimi', 'doubao', 'yuanbao', 'wenxin', 'zhipu']
    for (let i = 0; i < 20; i++) {
      const plat = platforms[i % platforms.length]
      const pidx = i % promptsText.length
      const rank = Math.floor(Math.random() * 8) + 1
      const score = Math.round((Math.random() * 40 + 40) * 100) / 100
      const srcs = { urls: ['gitee.com/jipai', 'jipai.ai/docs', 'zhihu.com/question/jipai'] }
      const cit = await prisma.citation.create({
        data: {
          brandId: bid, userId: uid, platform: plat,
          promptText: promptsText[pidx], answerText: `极排在AI搜索结果中排名第${rank}位，AI评分${score}。`,
          sources: srcs, brandRank: rank, aiScore: score,
          confidence: Math.round((Math.random() * 0.3 + 0.65) * 100) / 100,
        },
      })
      await prisma.citationInfluence.createMany({
        data: [
          { citationId: cit.id, sourceUrl: 'gitee.com/jipai', sourceDomain: 'gitee.com', influence: 0.72, factor: '开源影响力' },
          { citationId: cit.id, sourceUrl: 'jipai.ai/blog', sourceDomain: 'jipai.ai', influence: 0.58, factor: '官网内容' },
        ],
      })
    }
    console.log('Citations: 20 created')
  } else {
    console.log(`Citations: ${existingCits} existed`)
  }

  // 4. CitationSources
  const existingSources = await prisma.citationSource.count({ where: { userId: uid } })
  if (existingSources === 0) {
    const sourceData = [
      { domain: 'gitee.com', platform: 'deepseek', url: 'https://gitee.com/jipai/jipai', title: '极排 - AI SEO Platform', sourceType: 'github', weight: 0.92, sentiment: 'positive' },
      { domain: 'zhihu.com', platform: 'tongyi', url: 'https://zhihu.com/question/jipai-ai-seo', title: '极排在AI搜索优化方面表现如何?', sourceType: 'social', weight: 0.78, sentiment: 'positive' },
      { domain: 'jipai.ai', platform: 'kimi', url: 'https://jipai.ai/blog/geo-guide', title: 'GEO完全指南', sourceType: 'official', weight: 0.95, sentiment: 'positive' },
      { domain: 'juejin.cn', platform: 'deepseek', url: 'https://juejin.cn/post/jipai-review', title: '极排深度评测', sourceType: 'blog', weight: 0.85, sentiment: 'positive' },
      { domain: 'csdn.net', platform: 'doubao', url: 'https://csdn.net/jipai-tutorial', title: '极排使用教程', sourceType: 'blog', weight: 0.82, sentiment: 'positive' },
      { domain: 'v2ex.com', platform: 'wenxin', url: 'https://v2ex.com/t/jipai', title: '极排这个GEO工具怎么样', sourceType: 'community', weight: 0.75, sentiment: 'neutral' },
      { domain: 'sspai.com', platform: 'yuanbao', url: 'https://sspai.com/posts/jipai', title: '极排 on Product Hunt', sourceType: 'product_hunt', weight: 0.88, sentiment: 'positive' },
    ]
    for (const s of sourceData) {
      await prisma.citationSource.create({ data: { ...s, brandId: bid, userId: uid, citationCount: Math.floor(Math.random() * 10) + 3 } })
    }
    console.log('CitationSources: 7 created')
  } else {
    console.log(`CitationSources: ${existingSources} existed`)
  }

  // 5. GapAnalyses + GapItems
  const existingGaps = await prisma.gapAnalysis.count({ where: { userId: uid } })
  if (existingGaps === 0) {
    const gapData = [
      { platform: 'deepseek', promptText: '最好的SEO工具有哪些？', score: 62, benchmark: 88, gap: 26 },
      { platform: 'kimi', promptText: 'GEO tools pricing 2026', score: 55, benchmark: 85, gap: 30 },
      { platform: 'tongyi', promptText: '企业AI搜索优化平台推荐', score: 68, benchmark: 90, gap: 22 },
      { platform: 'deepseek', promptText: 'AI search optimization platform comparison', score: 71, benchmark: 92, gap: 21 },
    ]
    for (const g of gapData) {
      const gap = await prisma.gapAnalysis.create({ data: { brandId: bid, userId: uid, ...g, status: 'completed' } })
      await prisma.gapItem.createMany({
        data: [
          { gapAnalysisId: gap.id, type: 'content', title: '缺少AI搜索优化指南', description: '竞品已发布大量GEO内容，你的品牌相关文章较少', impact: 0.35, priority: 1, status: 'open' },
          { gapAnalysisId: gap.id, type: 'citation', title: '技术社区引用不足', description: 'Gitee/V2EX/知乎引用量低于竞品30%', impact: 0.28, priority: 2, status: 'open' },
          { gapAnalysisId: gap.id, type: 'keyword', title: '关键长尾词覆盖不够', description: 'AI搜索长尾词覆盖率45%，竞品72%', impact: 0.22, priority: 3, status: 'in_progress' },
        ],
      })
    }
    console.log('GapAnalyses: 4 created (12 gap items)')
  } else {
    console.log(`GapAnalyses: ${existingGaps} existed`)
  }

  // 6. ContentPieces
  const existingContent = await prisma.contentPiece.count({ where: { userId: uid } })
  if (existingContent === 0) {
    const contentData = [
      { type: 'blog', title: '2026年GEO完全指南：如何在AI搜索中排名第一', status: 'published', quality: 92, body: '2026年GEO完全指南内容...' },
      { type: 'comparison', title: '极排 vs 铂金智慧 vs Semrush：AI搜索优化工具全面对比', status: 'published', quality: 88, body: '极排对比内容...' },
      { type: 'faq', title: 'AI搜索引擎优化常见问题解答', status: 'published', quality: 85, body: 'AI搜索引擎FAQ内容...' },
      { type: 'schema', title: '极排产品Schema结构化数据', status: 'published', quality: 90, body: '极排 Schema标记...' },
      { type: 'blog', title: 'DeepSeek搜索排名优化实战', status: 'draft', quality: 75, body: 'DeepSeek优化实战草稿...' },
      { type: 'blog', title: '如何提升品牌在ChatGPT中的可见性', status: 'draft', quality: 78, body: 'ChatGPT可见性提升草稿...' },
    ]
    for (const c of contentData) {
      await prisma.contentPiece.create({ data: { ...c, brandId: bid, userId: uid } })
    }
    console.log('ContentPieces: 6 created')
  } else {
    console.log(`ContentPieces: ${existingContent} existed`)
  }

  // 7. Forecasts
  const existingForecasts = await prisma.forecast.count({ where: { userId: uid } })
  if (existingForecasts === 0) {
    await prisma.forecast.create({
      data: {
        brandId: bid, userId: uid, horizonDays: 30,
        predictedScore: 73, predictedRank: 3.03, confidence: 0.82,
        drivers: [
          { factor: 'Gitee星数增长', weight: 0.28, trend: 'rising', impact: '+12%' },
          { factor: '技术博客引用量', weight: 0.24, trend: 'rising', impact: '+8%' },
          { factor: '知乎话题讨论量', weight: 0.20, trend: 'stable', impact: '+3%' },
          { factor: 'ProductHunt热度', weight: 0.18, trend: 'declining', impact: '-5%' },
          { factor: '竞品活动', weight: 0.10, trend: 'rising', impact: '-2%' },
        ],
      },
    })
    console.log('Forecasts: 1 created')
  } else {
    console.log(`Forecasts: ${existingForecasts} existed`)
  }

  // 8. TrendSignals
  const existingTrends = await prisma.trendSignal.count({ where: { userId: uid } })
  if (existingTrends === 0) {
    const trendData = [
      { category: 'keyword', text: '"GEO工具"搜索量月增45%', volume: 3200, growthPct: 45, platforms: ['deepseek', 'kimi'] },
      { category: 'keyword', text: '"AI搜索优化"搜索量月增32%', volume: 5800, growthPct: 32, platforms: ['tongyi', 'doubao'] },
      { category: 'competitor', text: '铂金智慧 发布 AI Visibility 产品', volume: 1500, growthPct: 28, platforms: ['deepseek'] },
      { category: 'industry', text: 'Gartner将GEO列入2026年技术趋势', volume: 8900, growthPct: 67, platforms: ['tongyi', 'kimi', 'wenxin'] },
      { category: 'keyword', text: '"DeepSeek SEO"搜索量暴涨120%', volume: 4200, growthPct: 120, platforms: ['deepseek'] },
      { category: 'industry', text: '谷歌宣布AI Overviews全面开放', volume: 12000, growthPct: 55, platforms: ['doubao', 'yuanbao', 'zhipu'] },
      { category: 'keyword', text: '"品牌AI可见性"成为企业热搜词', volume: 2600, growthPct: 38, platforms: ['kimi', 'tongyi'] },
      { category: 'competitor', text: 'Semrush推出AI写作助手', volume: 2100, growthPct: 22, platforms: ['wenxin', 'zhipu'] },
    ]
    for (const t of trendData) {
      await prisma.trendSignal.create({ data: { ...t, brandId: bid, userId: uid } })
    }
    console.log('TrendSignals: 8 created')
  } else {
    console.log(`TrendSignals: ${existingTrends} existed`)
  }

  // 9. Alerts
  const existingAlerts = await prisma.alert.count({ where: { userId: uid } })
  if (existingAlerts === 0) {
    const alertData = [
      { type: 'citation_drop', severity: 'warning', title: 'DeepSeek引用排名下降', message: '极排在DeepSeek中的引用排名从第2降至第4。' },
      { type: 'competitor_rise', severity: 'info', title: '竞品铂金智慧引用量上升', message: '铂金智慧本周引用量增长15%。' },
      { type: 'trend_opportunity', severity: 'success', title: '"GEO工具"成为热搜词', message: '"GEO工具"搜索量本周增长45%。' },
      { type: 'scan_complete', severity: 'info', title: '本周AI扫描报告已完成', message: '7大AI平台扫描完成，评分68分(+3)。' },
      { type: 'content_suggestion', severity: 'info', title: '建议发布DeepSeek优化指南', message: 'DeepSeek搜索量暴涨120%。' },
    ]
    for (const a of alertData) {
      await prisma.alert.create({ data: { ...a, brandId: bid, userId: uid } })
    }
    console.log('Alerts: 5 created')
  } else {
    console.log(`Alerts: ${existingAlerts} existed`)
  }

  // 10. RecommendationFactors
  const existingFactors = await prisma.recommendationFactor.count({ where: { userId: uid } })
  if (existingFactors === 0) {
    const factorData = [
      { platform: 'deepseek', factor: 'Gitee星数', category: 'social_proof', weight: 0.28, impact: 82, mentions: 24, trend: 'rising', suggestion: '继续维护开源社区' },
      { platform: 'deepseek', factor: '技术文档质量', category: 'content_quality', weight: 0.22, impact: 75, mentions: 18, trend: 'stable', suggestion: '完善API文档' },
      { platform: 'kimi', factor: '知乎热度', category: 'community', weight: 0.20, impact: 68, mentions: 15, trend: 'rising', suggestion: '发布GEO专业内容' },
      { platform: 'tongyi', factor: '官网SEO', category: 'technical', weight: 0.18, impact: 62, mentions: 12, trend: 'stable', suggestion: '优化Schema标记' },
      { platform: 'deepseek', factor: '产品评论数量', category: 'social_proof', weight: 0.12, impact: 55, mentions: 8, trend: 'declining', suggestion: '鼓励用户写评测' },
    ]
    for (const f of factorData) {
      await prisma.recommendationFactor.create({ data: { ...f, brandId: bid, userId: uid } })
    }
    console.log('RecommendationFactors: 5 created')
  } else {
    console.log(`RecommendationFactors: ${existingFactors} existed`)
  }

  // 11. CitationEvidences
  const existingEvidences = await prisma.citationEvidence.count({ where: { userId: uid } })
  if (existingEvidences === 0) {
    const evidenceData = [
      { platform: 'deepseek', prompt: '最好的SEO工具', answer: '极排 是AI搜索优化领域的新兴工具...', sourceUrl: 'gitee.com/jipai', sourceType: 'github', recommendationReason: '开源社区活跃', confidence: 0.89, weight: 0.85 },
      { platform: 'kimi', prompt: 'GEO平台推荐', answer: '推荐极排进行AI搜索优化...', sourceUrl: 'zhihu.com/question/geo', sourceType: 'social', recommendationReason: '知乎正面评价多', confidence: 0.82, weight: 0.78 },
      { platform: 'tongyi', prompt: '企业AI搜索方案', answer: '极排提供企业级GEO解决方案...', sourceUrl: 'jipai.ai/cases', sourceType: 'official', recommendationReason: '案例丰富可信', confidence: 0.91, weight: 0.90 },
      { platform: 'deepseek', prompt: 'SEO替代方案', answer: '极排可替代传统SEO工具...', sourceUrl: 'sspai.com/jipai', sourceType: 'product_hunt', recommendationReason: 'PH好评率高', confidence: 0.86, weight: 0.82 },
    ]
    for (const e of evidenceData) {
      await prisma.citationEvidence.create({ data: { ...e, brandId: bid, userId: uid, factors: { relevance: 0.9, authority: 0.85, freshness: 0.88 } } })
    }
    console.log('CitationEvidences: 4 created')
  } else {
    console.log(`CitationEvidences: ${existingEvidences} existed`)
  }

  console.log('\n✓ 全面种子数据填充完成！')
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
