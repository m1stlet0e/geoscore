// ============================================
// Citation Intelligence 2.0 — Recommendation Factor Engine
// 分析 AI 为什么推荐竞品，量化每个因子的影响力
// ============================================

import { prisma } from '@/lib/prisma'
import { jsonChat } from '@/lib/deepseek'

// 预定义的推荐因子类别
const FACTOR_CATEGORIES = {
  social_proof: ['GitHub 星数', '用户评价', '社区活跃度', '下载量', '媒体报道', '知乎热度', 'B站视频数'],
  content_quality: ['文档质量', '教程丰富度', '案例展示', 'FAQ 完整性', '博客内容', '白皮书'],
  technical: ['性能指标', 'API 设计', '开源协议', '更新频率', '安全审计', '技术架构'],
  community: ['社区响应速度', 'Issue 处理', 'PR 合并速度', '贡献者数量', 'Discord/微信群'],
  commercial: ['定价策略', '客户案例', '合作伙伴', '融资情况', '市场份额'],
  seo_content: ['官网 SEO', '百度收录', '知乎文章', 'CSDN 博客', '掘金文章', '公众号文章'],
}

// 因子中文名映射
const FACTOR_CN: Record<string, string> = {
  social_proof: '社会证明',
  content_quality: '内容质量',
  technical: '技术实力',
  community: '社区活跃',
  commercial: '商业能力',
  seo_content: '内容覆盖',
}

interface FactorAnalysis {
  factor: string
  category: string
  weight: number
  impact: number
  mentions: number
  trend: 'rising' | 'stable' | 'declining'
  competitor: string | null
  suggestion: string
  evidence: string[]
}

export class RecommendationFactorEngine {
  /**
   * 分析一次扫描的所有结果，提取推荐因子
   */
  async analyzeScan(scanRunId: string): Promise<number> {
    const scanRun = await prisma.scanRun.findUnique({
      where: { id: scanRunId },
      include: {
        brand: true,
        promptScans: {
          include: { prompt: true },
        },
      },
    })

    if (!scanRun || !scanRun.brand) return 0

    const brand = scanRun.brand
    const competitors = brand.competitors || []

    // 收集所有有意义的 AI 回答
    const answers = scanRun.promptScans
      .filter(ps => ps.responseText && ps.responseText.length > 50)
      .map(ps => ({
        platform: ps.platform,
        prompt: ps.prompt.text,
        answer: ps.responseText!,
        brandMentioned: ps.brandMentioned,
        brandRank: ps.brandRank,
      }))

    if (answers.length === 0) return 0

    // 批量分析：每 3 个回答一组，用 DeepSeek 提取推荐因子
    const allFactors: FactorAnalysis[] = []
    
    for (let i = 0; i < answers.length; i += 3) {
      const batch = answers.slice(i, i + 3)
      const factors = await this.extractFactors(brand.name, competitors, batch)
      allFactors.push(...factors)
    }

    // 聚合去重 + 写入数据库
    const merged = this.mergeFactors(allFactors)
    await this.saveFactors(brand.id, brand.userId, merged)

    return merged.length
  }

  /**
   * 用 DeepSeek 从 AI 回答中提取推荐因子
   */
  private async extractFactors(
    brandName: string,
    competitors: string[],
    answers: Array<{ platform: string; prompt: string; answer: string; brandMentioned: boolean; brandRank: number | null }>
  ): Promise<FactorAnalysis[]> {
    const competitorList = competitors.length > 0 ? competitors.join('、') : '无'

    const prompt = `你是一个 AI 推荐因子分析专家。请分析以下 AI 平台对"${brandName}"相关问题的回答，提取**为什么 AI 推荐或不推荐这个品牌**的深层原因。

竞品列表：${competitorList}

${answers.map((a, i) => `
--- 回答 ${i + 1} (平台: ${a.platform}, 问题: "${a.prompt}") ---
品牌被提及: ${a.brandMentioned ? '是' : '否'}
品牌排名: ${a.brandRank ?? '未上榜'}
AI 回答:
${a.answer.slice(0, 1500)}
`).join('\n')}

请分析并返回 JSON 数组，每个因子包含：
- factor: 因子名称（如 "GitHub 星数"、"文档质量"、"知乎热度"）
- category: 类别（social_proof/content_quality/technical/community/commercial/seo_content）
- weight: 该因子在推荐决策中的权重 (0-1)
- impact: 对品牌排名的量化影响 (0-100，正面=提升排名，负面=降低排名)
- mentions: 被提及次数
- trend: rising/stable/declining
- competitor: 如果有竞品在这个因子上更强，写竞品名；否则 null
- suggestion: 具体可执行的改进建议（一句话）
- evidence: 从回答中摘录的证据片段（最多 3 条）

只返回 JSON 数组，不要其他内容。`

    try {
      const factors = await jsonChat<FactorAnalysis[]>(
        [{ role: 'user', content: prompt }],
        { temperature: 0.3, maxTokens: 4000 }
      )

      if (!Array.isArray(factors)) return []

      return factors.filter(f => f.factor && f.category)
    } catch (error) {
      console.error('Recommendation factor extraction failed:', error)
      return []
    }
  }

  /**
   * 合并去重因子（同品牌+同平台+同因子名 → 取最高 impact）
   */
  private mergeFactors(factors: FactorAnalysis[]): FactorAnalysis[] {
    const map = new Map<string, FactorAnalysis>()
    
    for (const f of factors) {
      const key = `${f.factor}|${f.category}`
      const existing = map.get(key)
      if (!existing || f.impact > existing.impact) {
        map.set(key, {
          ...f,
          mentions: (existing?.mentions || 0) + f.mentions,
          evidence: [...(existing?.evidence || []), ...(f.evidence || [])].slice(0, 5),
        })
      }
    }

    return Array.from(map.values())
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
  }

  /**
   * 保存因子到数据库
   */
  private async saveFactors(
    brandId: string,
    userId: string,
    factors: FactorAnalysis[]
  ): Promise<void> {
    // 删除旧因子
    await prisma.recommendationFactor.deleteMany({
      where: { brandId },
    })

    // 批量插入
    const data = factors.map(f => ({
      brandId,
      userId,
      platform: 'all', // 跨平台聚合
      factor: f.factor,
      category: f.category,
      weight: f.weight,
      impact: f.impact,
      mentions: f.mentions,
      trend: f.trend,
      competitor: f.competitor,
      suggestion: f.suggestion,
      evidence: f.evidence,
    }))

    if (data.length > 0) {
      await prisma.recommendationFactor.createMany({ data })
    }
  }

  /**
   * 获取品牌的推荐因子分析
   */
  async getFactors(brandId: string) {
    const factors = await prisma.recommendationFactor.findMany({
      where: { brandId },
      orderBy: { impact: 'desc' },
    })

    // 按类别分组
    const byCategory: Record<string, typeof factors> = {}
    const categorySummary: Array<{
      category: string
      label: string
      totalImpact: number
      avgWeight: number
      count: number
      topFactor: string
    }> = []

    for (const f of factors) {
      if (!byCategory[f.category]) byCategory[f.category] = []
      byCategory[f.category].push(f)
    }

    for (const [cat, items] of Object.entries(byCategory)) {
      categorySummary.push({
        category: cat,
        label: FACTOR_CN[cat] || cat,
        totalImpact: items.reduce((s, i) => s + i.impact, 0),
        avgWeight: items.reduce((s, i) => s + i.weight, 0) / items.length,
        count: items.length,
        topFactor: items[0]?.factor || '',
      })
    }

    categorySummary.sort((a, b) => b.totalImpact - a.totalImpact)

    // 竞品对比
    const competitorFactors = factors.filter(f => f.competitor)
    const competitorSummary = new Map<string, number>()
    for (const f of competitorFactors) {
      const name = f.competitor!
      competitorSummary.set(name, (competitorSummary.get(name) || 0) + Math.abs(f.impact))
    }

    return {
      factors,
      byCategory,
      categorySummary,
      competitorThreats: Array.from(competitorSummary.entries())
        .map(([name, score]) => ({ name, threatScore: score }))
        .sort((a, b) => b.threatScore - a.threatScore),
      totalFactors: factors.length,
      positiveFactors: factors.filter(f => f.impact > 0).length,
      negativeFactors: factors.filter(f => f.impact < 0).length,
    }
  }
}

export const recommendationFactorEngine = new RecommendationFactorEngine()
