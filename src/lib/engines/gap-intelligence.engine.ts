// ============================================
// GEO Gap Intelligence 2.0
// 量化影响 + 优先级排序 + 自动生成解决方案
// ============================================

import { prisma } from '@/lib/prisma'
import { jsonChat } from '@/lib/deepseek'

// 预定义的 Gap 类型及默认影响值
const GAP_TYPES = {
  faq_missing: { label: 'FAQ 缺失', defaultImpact: -24, category: 'content' },
  case_missing: { label: '案例缺失', defaultImpact: -18, category: 'content' },
  comparison_missing: { label: '对比内容缺失', defaultImpact: -12, category: 'content' },
  doc_quality: { label: '文档质量不足', defaultImpact: -15, category: 'technical' },
  tutorial_missing: { label: '教程缺失', defaultImpact: -14, category: 'content' },
  blog_inactive: { label: '博客不活跃', defaultImpact: -10, category: 'content' },
  seo_weak: { label: 'SEO 薄弱', defaultImpact: -20, category: 'technical' },
  social_proof_weak: { label: '社会证明不足', defaultImpact: -16, category: 'social' },
  community_small: { label: '社区规模小', defaultImpact: -13, category: 'community' },
  pricing_unclear: { label: '定价不透明', defaultImpact: -8, category: 'commercial' },
  api_doc_missing: { label: 'API 文档缺失', defaultImpact: -11, category: 'technical' },
  localization_weak: { label: '本地化不足', defaultImpact: -9, category: 'content' },
}

interface GapSolution {
  title: string
  description: string
  effort: 'low' | 'medium' | 'high'
  expectedImpact: number
  timeline: string
  steps: string[]
  template?: string
}

interface QuantifiedGap {
  type: string
  label: string
  impact: number
  priority: number
  evidence: string[]
  competitorDoing: string | null
  solutions: GapSolution[]
}

export class GapIntelligenceEngine {
  /**
   * 分析品牌的 GEO Gap，量化影响并生成解决方案
   */
  async analyzeGaps(
    brandId: string,
    userId: string,
    scanResults: Array<{
      platform: string
      promptText: string
      answerText: string
      brandMentioned: boolean
      brandRank: number | null
    }>
  ): Promise<number> {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) return 0

    const competitors = brand.competitors || []

    // 用 DeepSeek 分析 Gap
    const gaps = await this.extractGaps(
      brand.name,
      competitors,
      scanResults
    )

    if (gaps.length === 0) return 0

    // 保存到数据库
    await this.saveGaps(brandId, userId, gaps)

    return gaps.length
  }

  private async extractGaps(
    brandName: string,
    competitors: string[],
    scanResults: Array<{
      platform: string
      promptText: string
      answerText: string
      brandMentioned: boolean
      brandRank: number | null
    }>
  ): Promise<QuantifiedGap[]> {
    const competitorList = competitors.length > 0 ? competitors.join('、') : '无'

    const prompt = `你是一个 GEO（生成式引擎优化）差距分析专家。请分析品牌"${brandName}"在 AI 平台上的表现差距。

竞品：${competitorList}

以下是 AI 平台对相关问题的回答分析：

${scanResults.map((r, i) => `
--- 回答 ${i + 1} (平台: ${r.platform}) ---
问题: "${r.promptText}"
品牌被提及: ${r.brandMentioned ? '是' : '否'}
品牌排名: ${r.brandRank ?? '未上榜'}
AI 回答摘要: ${r.answerText.slice(0, 800)}
`).join('\n')}

请分析品牌"${brandName}"的 GEO 差距，返回 JSON 数组。每个差距包含：
- type: 差距类型（faq_missing/case_missing/comparison_missing/doc_quality/tutorial_missing/blog_inactive/seo_weak/social_proof_weak/community_small/pricing_unclear/api_doc_missing/localization_weak）
- label: 中文标签
- impact: 对 AI 可见性的量化影响（负数，-100 到 0）
- priority: 优先级（1=最高, 5=最低）
- evidence: 从回答中提取的证据（最多 3 条）
- competitorDoing: 如果有竞品在这方面做得更好，写竞品名；否则 null
- solutions: 解决方案数组，每个包含：
  - title: 方案标题
  - description: 方案描述
  - effort: low/medium/high
  - expectedImpact: 预期影响（正数）
  - timeline: 时间线（如 "1-2周"）
  - steps: 具体步骤（3-5步）
  - template: 可选的内容模板

只返回 JSON 数组，不要其他内容。`

    try {
      const gaps = await jsonChat<QuantifiedGap[]>(
        [{ role: 'user', content: prompt }],
        { temperature: 0.3, maxTokens: 4000 }
      )

      if (!Array.isArray(gaps)) return []

      return gaps.filter(g => g.type && g.impact)
    } catch (error) {
      console.error('Gap analysis failed:', error)
      return []
    }
  }

  private async saveGaps(
    brandId: string,
    userId: string,
    gaps: QuantifiedGap[]
  ): Promise<void> {
    // 删除旧数据
    const oldGaps = await prisma.gapAnalysis.findMany({
      where: { brandId },
      select: { id: true },
    })
    for (const g of oldGaps) {
      await prisma.gapItem.deleteMany({ where: { gapAnalysisId: g.id } })
    }
    await prisma.gapAnalysis.deleteMany({ where: { brandId } })

    // 批量创建
    for (const gap of gaps) {
      const analysis = await prisma.gapAnalysis.create({
        data: {
          brandId,
          userId,
          platform: 'all',
          promptText: `Gap: ${gap.label}`,
          score: Math.max(0, 100 + gap.impact),
          benchmark: 85,
          gap: Math.abs(gap.impact),
          status: 'analyzed',
        },
      })

      // 创建 Gap Items（解决方案）
      for (const sol of gap.solutions) {
        await prisma.gapItem.create({
          data: {
            gapAnalysisId: analysis.id,
            type: gap.type,
            title: sol.title,
            description: sol.description,
            impact: sol.expectedImpact,
            priority: gap.priority,
            status: 'open',
          },
        })
      }
    }
  }

  /**
   * 获取品牌的 Gap 分析报告
   */
  async getGapReport(brandId: string) {
    const gaps = await prisma.gapAnalysis.findMany({
      where: { brandId },
      include: {
        gapItems: {
          orderBy: { priority: 'asc' },
        },
      },
      orderBy: { gap: 'desc' },
    })

    const totalImpact = gaps.reduce((s, g) => s + g.gap, 0)
    const avgScore = gaps.length > 0
      ? gaps.reduce((s, g) => s + g.score, 0) / gaps.length
      : 0

    // 按类别分组
    const byType: Record<string, { count: number; totalImpact: number; items: typeof gaps }> = {}
    for (const g of gaps) {
      const type = g.gapItems[0]?.type || 'unknown'
      if (!byType[type]) byType[type] = { count: 0, totalImpact: 0, items: [] }
      byType[type].count++
      byType[type].totalImpact += g.gap
      byType[type].items.push(g)
    }

    // 优先级排序的解决方案
    const allSolutions = gaps.flatMap(g => g.gapItems)
      .sort((a, b) => a.priority - b.priority || b.impact - a.impact)

    // 高/中/低努力度分组
    const byEffort = {
      low: allSolutions.filter(s => s.description.includes('low') || s.description.includes('低')),
      medium: allSolutions.filter(s => s.description.includes('medium') || s.description.includes('中')),
      high: allSolutions.filter(s => s.description.includes('high') || s.description.includes('高')),
    }

    return {
      gaps,
      summary: {
        totalGaps: gaps.length,
        totalImpact,
        avgScore,
        topGap: gaps[0] || null,
        urgentCount: gaps.filter(g => g.gap > 15).length,
      },
      byType,
      actionPlan: {
        quickWins: byEffort.low.slice(0, 3),
        strategicMoves: byEffort.medium.slice(0, 3),
        longTermBets: byEffort.high.slice(0, 3),
      },
      allSolutions,
    }
  }
}

export const gapIntelligenceEngine = new GapIntelligenceEngine()
