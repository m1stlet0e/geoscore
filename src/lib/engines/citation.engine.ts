// ============================================
// Citation Intelligence Engine 2.0
// 核心护城河 #1: 真正的推荐因子分析
// ============================================

import { prisma } from '@/lib/prisma'
import { jsonChat } from '@/lib/deepseek'

// ============================================
// Types
// ============================================

export interface CitationSource {
  url: string
  title: string
  domain: string
  snippet?: string
  position?: number
}

export interface RecommendationFactor {
  factor: string // github_activity, zhihu_community, wechat_content, etc.
  label: string // 中文标签
  weight: number // 0-1, 影响权重
  description: string // 具体说明
}

export interface CitationEvidenceData {
  platform: string
  prompt: string
  answer: string
  sourceUrl?: string
  sourceType?: string
  recommendationReason: string
  confidence: number
  weight: number
  factors: Record<string, number>
}

export interface CitationAnalysisResult {
  brandId: string
  platform: string
  aiScore: number // 0-100
  confidence: number // 0-1
  recommendationReason: string
  factors: RecommendationFactor[]
  evidenceCount: number
  summary: string
}

export interface SourceRanking {
  domain: string
  url: string
  title: string
  sourceType: string
  weight: number
  citationCount: number
  influenceScore: number
  recommendationReason: string
  firstSeen: Date
  lastSeen: Date
}

export interface FactorDistribution {
  factor: string
  label: string
  count: number
  totalWeight: number
  avgWeight: number
  percentage: number
}

// ============================================
// 推荐因子定义
// ============================================

const RECOMMENDATION_FACTORS: Record<string, { label: string; description: string }> = {
  github_activity: {
    label: 'GitHub 开源活跃度',
    description: '项目 Star、Fork、Issue、PR 活跃度',
  },
  zhihu_community: {
    label: '知乎社区讨论',
    description: '知乎回答、文章、讨论热度',
  },
  wechat_content: {
    label: '公众号内容覆盖',
    description: '微信公众号文章质量和覆盖面',
  },
  blog_authority: {
    label: '技术博客引用',
    description: 'CSDN、掘金、思否等技术博客引用',
  },
  docs_quality: {
    label: '官方文档质量',
    description: '技术文档完整性和易用性',
  },
  reddit_discussion: {
    label: '社区讨论度',
    description: 'Reddit、V2EX 等社区讨论',
  },
  media_coverage: {
    label: '媒体报道',
    description: '36氪、虎嗅、极客公园等媒体报道',
  },
  forum_discussion: {
    label: '论坛讨论',
    description: 'SegmentFault、CSDN 论坛等讨论',
  },
  social_mention: {
    label: '社交媒体提及',
    description: '微博、Twitter 等社交媒体提及',
  },
  producthunt_launch: {
    label: 'ProductHunt 发布',
    description: 'ProductHunt 产品发布和投票',
  },
}

// ============================================
// 国内平台定义
// ============================================

const DOMESTIC_PLATFORMS = [
  'deepseek',
  'kimi',
  'doubao',
  'yuanbao',
  'tongyi',
  'zhipu',
]

const INTERNATIONAL_PLATFORMS = [
  'chatgpt',
  'claude',
  'gemini',
  'perplexity',
]

// ============================================
// Core Engine Class
// ============================================

export class CitationEngine {
  // ============================================
  // 1. 分析推荐因子（核心）
  // ============================================

  async analyzeRecommendationFactors(
    brandId: string,
    userId: string,
    platform: string,
    prompt: string,
    answer: string,
    sources: CitationSource[]
  ): Promise<CitationAnalysisResult> {
    // 获取品牌信息
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    })

    if (!brand) throw new Error('Brand not found')

    // 构建分析 prompt
    const analysisPrompt = this.buildFactorAnalysisPrompt(
      brand.name,
      brand.category || 'SaaS',
      platform,
      prompt,
      answer,
      sources
    )

    // 调用 AI 分析
    const analysis = await jsonChat<{
      aiScore: number
      confidence: number
      recommendationReason: string
      factors: { factor: string; weight: number; description: string }[]
      sourceAnalysis: {
        url: string
        type: string
        reason: string
        weight: number
      }[]
    }>(
      [
        {
          role: 'system',
          content: `你是 GEO (Generative Engine Optimization) 专家。
分析品牌在 AI 回答中被推荐的真正原因和影响因子。

返回纯 JSON，不要 markdown 代码块。`,
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      { temperature: 0.3 }
    )

    // 保存证据
    const evidenceCount = await this.saveEvidence(
      brandId,
      userId,
      platform,
      prompt,
      answer,
      analysis.sourceAnalysis || [],
      analysis.recommendationReason,
      analysis.confidence,
      analysis.factors
    )

    // 计算因子分布
    const factors: RecommendationFactor[] = (analysis.factors || []).map((f) => ({
      factor: f.factor,
      label: RECOMMENDATION_FACTORS[f.factor]?.label || f.factor,
      weight: f.weight,
      description: f.description,
    }))

    return {
      brandId,
      platform,
      aiScore: analysis.aiScore || 0,
      confidence: analysis.confidence || 0,
      recommendationReason: analysis.recommendationReason || 'No reason',
      factors,
      evidenceCount,
      summary: this.generateSummary(factors, analysis.aiScore),
    }
  }

  // ============================================
  // 2. 构建因子分析 Prompt
  // ============================================

  private buildFactorAnalysisPrompt(
    brandName: string,
    brandCategory: string,
    platform: string,
    prompt: string,
    answer: string,
    sources: CitationSource[]
  ): string {
    const sourceList = sources
      .map(
        (s, i) =>
          `${i + 1}. ${s.title || 'No Title'}
   URL: ${s.url}
   Domain: ${this.extractDomain(s.url)}
   Snippet: ${s.snippet || 'N/A'}`
      )
      .join('\n\n')

    return `## 推荐因子分析任务

分析品牌 "${brandName}" (${brandCategory}) 在 ${platform} 平台上被推荐的真正原因。

### 用户 Prompt
${prompt}

### AI 回答
${answer}

### 引用来源（共 ${sources.length} 个）
${sourceList || '无引用来源'}

### 分析要求

1. **推荐原因分析** - 品牌为什么被推荐？核心原因是什么？

2. **影响因子分解** - 从以下维度分析影响权重（总和=100%）：
   - github_activity: GitHub 开源活跃度
   - zhihu_community: 知乎社区讨论
   - wechat_content: 公众号内容覆盖
   - blog_authority: 技术博客引用
   - docs_quality: 官方文档质量
   - reddit_discussion: 社区讨论度
   - media_coverage: 媒体报道
   - forum_discussion: 论坛讨论
   - social_mention: 社交媒体提及
   - producthunt_launch: ProductHunt 发布

3. **来源分析** - 每个引用来源的具体影响

### 输出要求

返回纯 JSON：
{
  "aiScore": 0-100 的推荐概率分数,
  "confidence": 0-1 的置信度,
  "recommendationReason": "一句话总结推荐原因",
  "factors": [
    {
      "factor": "因子名称",
      "weight": 0-1 的权重,
      "description": "具体影响说明"
    }
  ],
  "sourceAnalysis": [
    {
      "url": "来源URL",
      "type": "来源类型(github/zhihu/wechat/blog/docs等)",
      "reason": "为什么这个来源影响了推荐",
      "weight": 0-1 的影响权重
    }
  ]
}`
  }

  // ============================================
  // 3. 保存证据
  // ============================================

  private async saveEvidence(
    brandId: string,
    userId: string,
    platform: string,
    prompt: string,
    answer: string,
    sourceAnalysis: {
      url: string
      type: string
      reason: string
      weight: number
    }[],
    recommendationReason: string,
    confidence: number,
    factors: { factor: string; weight: number }[]
  ): Promise<number> {
    // 将 factors 转换为 Record<string, number>
    const factorsMap: Record<string, number> = {}
    for (const f of factors) {
      factorsMap[f.factor] = f.weight
    }

    let count = 0

    // 为每个来源创建一条证据
    if (sourceAnalysis.length > 0) {
      for (const source of sourceAnalysis) {
        await prisma.citationEvidence.create({
          data: {
            brandId,
            userId,
            platform,
            prompt,
            answer,
            sourceUrl: source.url,
            sourceType: source.type,
            recommendationReason: source.reason,
            confidence,
            weight: source.weight,
            factors: factorsMap,
          },
        })
        count++
      }
    } else {
      // 没有来源也创建一条，记录整体推荐原因
      await prisma.citationEvidence.create({
        data: {
          brandId,
          userId,
          platform,
          prompt,
          answer,
          recommendationReason,
          confidence,
          weight: 1,
          factors: factorsMap,
        },
      })
      count++
    }

    return count
  }

  // ============================================
  // 4. 获取因子分布
  // ============================================

  async getFactorDistribution(
    brandId: string,
    platform?: string
  ): Promise<FactorDistribution[]> {
    const where: any = { brandId }
    if (platform) where.platform = platform

    const evidences = await prisma.citationEvidence.findMany({
      where,
      select: { factors: true },
    })

    // 聚合因子权重
    const factorMap = new Map<string, { count: number; totalWeight: number }>()

    for (const ev of evidences) {
      if (ev.factors && typeof ev.factors === 'object') {
        const factors = ev.factors as Record<string, number>
        for (const [factor, weight] of Object.entries(factors)) {
          const existing = factorMap.get(factor) || { count: 0, totalWeight: 0 }
          existing.count++
          existing.totalWeight += weight
          factorMap.set(factor, existing)
        }
      }
    }

    // 计算百分比
    const totalWeight = Array.from(factorMap.values()).reduce(
      (sum, f) => sum + f.totalWeight,
      0
    )

    const result: FactorDistribution[] = Array.from(factorMap.entries())
      .map(([factor, data]) => ({
        factor,
        label: RECOMMENDATION_FACTORS[factor]?.label || factor,
        count: data.count,
        totalWeight: data.totalWeight,
        avgWeight: data.totalWeight / data.count,
        percentage: totalWeight > 0 ? (data.totalWeight / totalWeight) * 100 : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage)

    return result
  }

  // ============================================
  // 5. 获取来源排行
  // ============================================

  async getSourceRankings(
    brandId: string,
    platform?: string,
    limit: number = 50
  ): Promise<SourceRanking[]> {
    const where: any = { brandId, sourceUrl: { not: null } }
    if (platform) where.platform = platform

    const evidences = await prisma.citationEvidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit * 3, // 取更多用于聚合
    })

    // 按来源聚合
    const sourceMap = new Map<
      string,
      {
        url: string
        type: string
        count: number
        totalWeight: number
        reasons: string[]
        firstSeen: Date
        lastSeen: Date
      }
    >()

    for (const ev of evidences) {
      if (!ev.sourceUrl) continue

      const existing = sourceMap.get(ev.sourceUrl) || {
        url: ev.sourceUrl,
        type: ev.sourceType || 'other',
        count: 0,
        totalWeight: 0,
        reasons: [],
        firstSeen: ev.createdAt,
        lastSeen: ev.createdAt,
      }

      existing.count++
      existing.totalWeight += ev.weight || 0
      if (ev.recommendationReason) {
        existing.reasons.push(ev.recommendationReason)
      }
      if (ev.createdAt < existing.firstSeen) existing.firstSeen = ev.createdAt
      if (ev.createdAt > existing.lastSeen) existing.lastSeen = ev.createdAt

      sourceMap.set(ev.sourceUrl, existing)
    }

    // 转换并排序
    return Array.from(sourceMap.values())
      .map((s) => ({
        domain: this.extractDomain(s.url),
        url: s.url,
        title: '',
        sourceType: s.type,
        weight: s.totalWeight / s.count,
        citationCount: s.count,
        influenceScore: (s.totalWeight / s.count) * s.count,
        recommendationReason: s.reasons[0] || 'N/A',
        firstSeen: s.firstSeen,
        lastSeen: s.lastSeen,
      }))
      .sort((a, b) => b.influenceScore - a.influenceScore)
      .slice(0, limit)
  }

  // ============================================
  // 6. 获取平台统计
  // ============================================

  async getPlatformStats(brandId: string): Promise<
    {
      platform: string
      evidenceCount: number
      avgConfidence: number
      avgWeight: number
      topFactor: string
    }[]
  > {
    const evidences = await prisma.citationEvidence.findMany({
      where: { brandId },
    })

    // 按平台聚合
    const platformMap = new Map<
      string,
      {
        count: number
        totalConfidence: number
        totalWeight: number
        factors: Map<string, number>
      }
    >()

    for (const ev of evidences) {
      const existing = platformMap.get(ev.platform) || {
        count: 0,
        totalConfidence: 0,
        totalWeight: 0,
        factors: new Map<string, number>(),
      }

      existing.count++
      existing.totalConfidence += ev.confidence || 0
      existing.totalWeight += ev.weight || 0

      if (ev.factors && typeof ev.factors === 'object') {
        const factors = ev.factors as Record<string, number>
        for (const [factor, weight] of Object.entries(factors)) {
          existing.factors.set(factor, (existing.factors.get(factor) || 0) + weight)
        }
      }

      platformMap.set(ev.platform, existing)
    }

    return Array.from(platformMap.entries())
      .map(([platform, data]) => {
        // 找出最高权重的因子
        let topFactor = 'N/A'
        let maxWeight = 0
        for (const [factor, weight] of data.factors.entries()) {
          if (weight > maxWeight) {
            maxWeight = weight
            topFactor = factor
          }
        }

        return {
          platform,
          evidenceCount: data.count,
          avgConfidence: data.totalConfidence / data.count,
          avgWeight: data.totalWeight / data.count,
          topFactor: RECOMMENDATION_FACTORS[topFactor]?.label || topFactor,
        }
      })
      .sort((a, b) => b.evidenceCount - a.evidenceCount)
  }

  // ============================================
  // 7. 获取汇总统计
  // ============================================

  async getStats(brandId: string): Promise<{
    totalEvidence: number
    avgConfidence: number
    topPlatform: string
    topFactor: string
    domesticCount: number
    internationalCount: number
  }> {
    const evidences = await prisma.citationEvidence.findMany({
      where: { brandId },
    })

    const totalEvidence = evidences.length

    if (totalEvidence === 0) {
      return {
        totalEvidence: 0,
        avgConfidence: 0,
        topPlatform: 'N/A',
        topFactor: 'N/A',
        domesticCount: 0,
        internationalCount: 0,
      }
    }

    const avgConfidence =
      evidences.reduce((sum, e) => sum + (e.confidence || 0), 0) / totalEvidence

    // 平台分布
    const platformCounts = new Map<string, number>()
    for (const ev of evidences) {
      platformCounts.set(ev.platform, (platformCounts.get(ev.platform) || 0) + 1)
    }
    const topPlatform =
      Array.from(platformCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'N/A'

    // 国内/国际统计
    const domesticCount = evidences.filter((e) =>
      DOMESTIC_PLATFORMS.includes(e.platform)
    ).length
    const internationalCount = evidences.filter((e) =>
      INTERNATIONAL_PLATFORMS.includes(e.platform)
    ).length

    // 因子分布
    const factorMap = new Map<string, number>()
    for (const ev of evidences) {
      if (ev.factors && typeof ev.factors === 'object') {
        const factors = ev.factors as Record<string, number>
        for (const [factor, weight] of Object.entries(factors)) {
          factorMap.set(factor, (factorMap.get(factor) || 0) + weight)
        }
      }
    }
    const topFactor =
      Array.from(factorMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    return {
      totalEvidence,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      topPlatform,
      topFactor: RECOMMENDATION_FACTORS[topFactor]?.label || topFactor,
      domesticCount,
      internationalCount,
    }
  }

  // ============================================
  // 8. 获取证据列表
  // ============================================

  async getEvidences(
    brandId: string,
    userId: string,
    platform?: string,
    sourceType?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    evidences: any[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const where: any = { brandId, userId }
    if (platform) where.platform = platform
    if (sourceType) where.sourceType = sourceType

    const total = await prisma.citationEvidence.count({ where })

    const evidences = await prisma.citationEvidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      evidences,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  // ============================================
  // 9. 生成摘要
  // ============================================

  private generateSummary(factors: RecommendationFactor[], aiScore: number): string {
    if (factors.length === 0) return '暂无推荐因子数据'

    const top3 = factors.slice(0, 3)
    const factorNames = top3.map((f) => f.label).join('、')

    if (aiScore >= 80) {
      return `品牌推荐概率高(${aiScore}%)，核心影响因子：${factorNames}`
    } else if (aiScore >= 60) {
      return `品牌推荐概率中等(${aiScore}%)，主要依赖：${factorNames}`
    } else {
      return `品牌推荐概率较低(${aiScore}%)，建议加强：${factorNames}`
    }
  }

  // ============================================
  // 10. 辅助方法
  // ============================================

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  }

  // ============================================
  // 11. 获取平台列表
  // ============================================

  getPlatforms(): {
    domestic: { id: string; name: string; icon: string }[]
    international: { id: string; name: string; icon: string }[]
  } {
    return {
      domestic: [
        { id: 'deepseek', name: 'DeepSeek', icon: '🔮' },
        { id: 'kimi', name: 'Kimi', icon: '🌙' },
        { id: 'doubao', name: '豆包', icon: '🫘' },
        { id: 'yuanbao', name: '腾讯元宝', icon: '💰' },
        { id: 'tongyi', name: '通义千问', icon: '🤔' },
        { id: 'zhipu', name: '智谱清言', icon: '📚' },
      ],
      international: [
        { id: 'chatgpt', name: 'ChatGPT', icon: '🤖' },
        { id: 'claude', name: 'Claude', icon: '🧠' },
        { id: 'gemini', name: 'Gemini', icon: '✨' },
        { id: 'perplexity', name: 'Perplexity', icon: '🔍' },
      ],
    }
  }

  // ============================================
  // 12. 获取推荐因子定义
  // ============================================

  getFactorDefinitions(): typeof RECOMMENDATION_FACTORS {
    return RECOMMENDATION_FACTORS
  }
}

// 导出单例
export const citationEngine = new CitationEngine()
