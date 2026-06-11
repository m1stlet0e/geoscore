// ============================================
// GEO Gap Analysis Engine
// 核心护城河 #2: AI 为什么不推荐你
// ============================================

import { prisma } from '@/lib/prisma'
import { chat, jsonChat } from '@/lib/deepseek'

// ============================================
// Types
// ============================================

export interface GapItemData {
  type: 'faq' | 'comparison' | 'use_case' | 'schema' | 'media' | 'github' | 'readme' | 'blog' | 'reddit'
  title: string
  description: string
  impact: number // -100 to 0, negative means gap
  priority: number // 1 = highest
}

export interface GapAnalysisResult {
  analysisId: string
  brandId: string
  platform: string
  promptText: string
  score: number // 当前 AI 推荐分 0-100
  benchmark: number // 竞对/行业基准
  gap: number // 差距值
  items: GapItemData[]
  summary: string
}

export interface GapSummary {
  totalAnalyses: number
  avgGap: number
  biggestGap: number
  openItems: number
  topGapType: string
  trend: 'improving' | 'worsening' | 'stable'
}

// ============================================
// Core Engine Class
// ============================================

export class GapEngine {
  // ============================================
  // 1. 触发 Gap 分析
  // ============================================
  
  async analyzeGap(
    brandId: string,
    userId: string,
    platform: string,
    promptText: string,
    competitorId?: string
  ): Promise<GapAnalysisResult> {
    // 获取品牌信息
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      include: { competitors: true }
    })

    if (!brand) throw new Error('Brand not found')

    // 获取竞对信息
    let competitorName: string | undefined
    if (competitorId) {
      const competitor = await prisma.brand.findUnique({
        where: { id: competitorId }
      })
      competitorName = competitor?.name
    }

    // 创建分析记录
    const analysis = await prisma.gapAnalysis.create({
      data: {
        brandId,
        userId,
        competitorId,
        platform,
        promptText,
        score: 0,
        benchmark: 0,
        gap: 0,
        status: 'analyzing'
      }
    })

    // 调用 AI 分析
    const result = await this.callAIAnalysis(
      brand.name,
      brand.category || 'SaaS',
      platform,
      promptText,
      competitorName
    )

    // 更新分析记录
    await prisma.gapAnalysis.update({
      where: { id: analysis.id },
      data: {
        score: result.score,
        benchmark: result.benchmark,
        gap: result.gap,
        status: 'completed'
      }
    })

    // 保存 Gap 项
    for (const item of result.items) {
      await prisma.gapItem.create({
        data: {
          gapAnalysisId: analysis.id,
          type: item.type,
          title: item.title,
          description: item.description,
          impact: item.impact,
          priority: item.priority
        }
      })
    }

    return {
      analysisId: analysis.id,
      brandId,
      platform,
      promptText,
      score: result.score,
      benchmark: result.benchmark,
      gap: result.gap,
      items: result.items,
      summary: result.summary
    }
  }

  // ============================================
  // 2. 调用 AI 进行 Gap 分析
  // ============================================

  private async callAIAnalysis(
    brandName: string,
    brandCategory: string,
    platform: string,
    promptText: string,
    competitorName?: string
  ): Promise<{
    score: number
    benchmark: number
    gap: number
    items: GapItemData[]
    summary: string
  }> {
    const competitorContext = competitorName
      ? `与竞对 "${competitorName}" 进行对比分析。`
      : `进行行业基准分析。`

    const analysisPrompt = `## GEO Gap 分析任务

分析品牌 "${brandName}" (${brandCategory}) 在 ${platform} 平台上，针对以下用户问题的 AI 推荐情况：

**用户问题**: ${promptText}

${competitorContext}

### 分析维度

请从以下 8 个维度评估品牌被 AI 推荐的概率差距：

1. **FAQ 覆盖** - 品牌是否有足够的 FAQ 内容回答用户常见问题
2. **对比内容** - 品牌是否有与竞对的对比评测内容
3. **使用案例** - 品牌是否有丰富的使用场景和案例
4. **Schema 标记** - 品牌网站是否有结构化数据标记
5. **媒体曝光** - 品牌在主流媒体/博客的曝光度
6. **GitHub 活跃度** - 品牌在 GitHub 的开源项目活跃度
7. **文档质量** - 品牌的技术文档/README 质量
8. **社区讨论** - 品牌在 Reddit/论坛的社区讨论度

### 输出要求

请用 JSON 格式返回：
{
  "score": 0-100 的当前 AI 推荐分,
  "benchmark": 0-100 的竞对/行业基准分,
  "gap": 负数的差距值 (benchmark - score),
  "items": [
    {
      "type": "faq|comparison|use_case|schema|media|github|readme|blog|reddit",
      "title": "差距项标题",
      "description": "具体差距描述和改进建议",
      "impact": -100 到 0 的影响值 (负数表示差距),
      "priority": 1-8 的优先级 (1最高)
    }
  ],
  "summary": "一句话总结最大的差距和改进方向"
}`

    const response = await jsonChat<{
      score: number
      benchmark: number
      gap: number
      items: GapItemData[]
      summary: string
    }>([
      {
        role: 'system',
        content: `你是 GEO (Generative Engine Optimization) 专家。分析品牌在 AI 搜索中的推荐差距，给出具体可执行的改进建议。

返回纯 JSON，不要 markdown 代码块。`
      },
      {
        role: 'user',
        content: analysisPrompt
      }
    ])

    return {
      score: Math.max(0, Math.min(100, response.score || 0)),
      benchmark: Math.max(0, Math.min(100, response.benchmark || 0)),
      gap: response.gap || 0,
      items: Array.isArray(response.items) ? response.items : [],
      summary: response.summary || 'No summary'
    }
  }

  // ============================================
  // 3. 获取 Gap 分析列表
  // ============================================

  async getAnalyses(
    brandId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    analyses: any[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const where = { brandId, userId }
    const total = await prisma.gapAnalysis.count({ where })

    const analyses = await prisma.gapAnalysis.findMany({
      where,
      include: {
        gapItems: {
          orderBy: { priority: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })

    return {
      analyses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  }

  // ============================================
  // 4. 获取 Gap 分析详情
  // ============================================

  async getAnalysisDetail(analysisId: string, userId: string): Promise<any | null> {
    const analysis = await prisma.gapAnalysis.findFirst({
      where: {
        id: analysisId,
        userId
      },
      include: {
        gapItems: {
          orderBy: { priority: 'asc' }
        },
        brand: {
          select: { id: true, name: true, domain: true }
        }
      }
    })

    return analysis
  }

  // ============================================
  // 5. 获取 Gap 汇总统计
  // ============================================

  async getSummary(brandId: string, userId: string): Promise<GapSummary> {
    const analyses = await prisma.gapAnalysis.findMany({
      where: { brandId, userId },
      include: { gapItems: true },
      orderBy: { createdAt: 'desc' }
    })

    const totalAnalyses = analyses.length

    if (totalAnalyses === 0) {
      return {
        totalAnalyses: 0,
        avgGap: 0,
        biggestGap: 0,
        openItems: 0,
        topGapType: 'N/A',
        trend: 'stable'
      }
    }

    // 计算平均差距
    const avgGap = analyses.reduce((sum, a) => sum + a.gap, 0) / totalAnalyses

    // 最大差距
    const biggestGap = Math.min(...analyses.map(a => a.gap))

    // 统计未解决的 Gap 项
    const allItems = analyses.flatMap(a => a.gapItems)
    const openItems = allItems.filter(i => i.status === 'open').length

    // 最常见的 Gap 类型
    const typeCounts = new Map<string, number>()
    for (const item of allItems) {
      typeCounts.set(item.type, (typeCounts.get(item.type) || 0) + 1)
    }
    const topGapType = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    // 趋势分析（最近 5 次 vs 之前 5 次）
    let trend: 'improving' | 'worsening' | 'stable' = 'stable'
    if (analyses.length >= 10) {
      const recent5 = analyses.slice(0, 5)
      const previous5 = analyses.slice(5, 10)
      const recentAvg = recent5.reduce((sum, a) => sum + a.gap, 0) / 5
      const previousAvg = previous5.reduce((sum, a) => sum + a.gap, 0) / 5
      
      if (recentAvg > previousAvg * 1.1) trend = 'improving'
      else if (recentAvg < previousAvg * 0.9) trend = 'worsening'
    }

    return {
      totalAnalyses,
      avgGap: Math.round(avgGap * 100) / 100,
      biggestGap: Math.round(biggestGap * 100) / 100,
      openItems,
      topGapType,
      trend
    }
  }

  // ============================================
  // 6. 获取 Gap 项列表
  // ============================================

  async getGapItems(
    analysisId: string,
    userId: string,
    status?: string
  ): Promise<any[]> {
    // 验证分析属于当前用户
    const analysis = await prisma.gapAnalysis.findFirst({
      where: {
        id: analysisId,
        userId
      }
    })

    if (!analysis) return []

    const where: any = { gapAnalysisId: analysisId }
    if (status) where.status = status

    return prisma.gapItem.findMany({
      where,
      orderBy: { priority: 'asc' }
    })
  }

  // ============================================
  // 7. 更新 Gap 项状态
  // ============================================

  async updateGapItemStatus(
    itemId: string,
    userId: string,
    status: 'open' | 'in_progress' | 'resolved'
  ): Promise<boolean> {
    // 验证 Gap 项属于当前用户
    const item = await prisma.gapItem.findFirst({
      where: {
        id: itemId,
        gapAnalysis: {
          userId
        }
      }
    })

    if (!item) return false

    await prisma.gapItem.update({
      where: { id: itemId },
      data: { status }
    })

    return true
  }

  // ============================================
  // 8. 批量分析（多个 Prompt）
  // ============================================

  async batchAnalyze(
    brandId: string,
    userId: string,
    platform: string,
    promptTexts: string[],
    competitorId?: string
  ): Promise<GapAnalysisResult[]> {
    const results: GapAnalysisResult[] = []

    for (const promptText of promptTexts) {
      try {
        const result = await this.analyzeGap(
          brandId,
          userId,
          platform,
          promptText,
          competitorId
        )
        results.push(result)
      } catch (error) {
        console.error(`Failed to analyze gap for prompt: ${promptText}`, error)
      }
    }

    return results
  }

  // ============================================
  // 9. 获取 Gap 类型分布
  // ============================================

  async getGapTypeDistribution(
    brandId: string,
    userId: string
  ): Promise<{ type: string; count: number; avgImpact: number }[]> {
    const analyses = await prisma.gapAnalysis.findMany({
      where: { brandId, userId },
      include: { gapItems: true }
    })

    const allItems = analyses.flatMap(a => a.gapItems)
    const typeMap = new Map<string, { count: number; totalImpact: number }>()

    for (const item of allItems) {
      const existing = typeMap.get(item.type) || { count: 0, totalImpact: 0 }
      existing.count++
      existing.totalImpact += item.impact
      typeMap.set(item.type, existing)
    }

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      avgImpact: Math.round((data.totalImpact / data.count) * 100) / 100
    }))
  }
}

// 导出单例
export const gapEngine = new GapEngine()
