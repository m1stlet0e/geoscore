// ============================================
// Citation Intelligence Engine
// 核心护城河 #1: 谁在影响 AI 推荐你的品牌
// ============================================

import { prisma } from '@/lib/prisma'
import { chat, jsonChat } from '@/lib/deepseek'

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

export interface InfluenceFactor {
  factor: string
  impact: number // -100 to 100
  description: string
}

export interface CitationAnalysis {
  citationId: string
  aiScore: number // 0-100
  confidence: number // 0-1
  influences: InfluenceFactor[]
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
  sentiment: 'positive' | 'neutral' | 'negative'
  firstSeen: Date
  lastSeen: Date
}

export interface NetworkNode {
  id: string
  label: string
  type: 'brand' | 'source' | 'platform'
  size: number
  color: string
}

export interface NetworkEdge {
  source: string
  target: string
  weight: number
  label: string
}

export interface NetworkGraph {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
}

// ============================================
// Core Engine Class
// ============================================

export class CitationEngine {


  constructor() {

  }

  // ============================================
  // 1. 从扫描结果提取引用数据
  // ============================================
  
  async extractCitations(scanJobId: string): Promise<string[]> {
    const scanResults = await prisma.promptScan.findMany({
      where: { scanRunId: scanJobId },
      include: { prompt: true }
    })

    const citationIds: string[] = []

    for (const result of scanResults) {
      if (!result.citedSources || !Array.isArray(result.citedSources)) continue

      const sources = result.citedSources as CitationSource[]
      
      // 创建 Citation 记录
      const citation = await prisma.citation.create({
        data: {
          brandId: result.prompt.brandId,
          userId: result.prompt.userId,
          platform: result.platform,
          promptText: result.prompt.text,
          answerText: result.responseText || '',
          sources: sources,
          brandRank: result.brandRank,
          brandContext: result.brandContext || null,
          createdAt: new Date()
        }
      })

      citationIds.push(citation.id)

      // 提取并保存 CitationSource
      await this.extractSources(citation.id, result.prompt.brandId, result.prompt.userId, result.platform, sources)
    }

    return citationIds
  }

  // ============================================
  // 2. 提取引用来源
  // ============================================

  private async extractSources(
    citationId: string,
    brandId: string,
    userId: string,
    platform: string,
    sources: CitationSource[]
  ): Promise<void> {
    for (const source of sources) {
      const domain = this.extractDomain(source.url)
      const sourceType = this.classifySource(domain)

      await prisma.citationSource.upsert({
        where: {
          brandId_platform_url: {
            brandId,
            platform,
            url: source.url
          }
        },
        update: {
          citationCount: { increment: 1 },
          lastSeen: new Date()
        },
        create: {
          brandId,
          userId,
          domain,
          platform,
          url: source.url,
          title: source.title,
          sourceType,
          weight: 1.0,
          citationCount: 1,
          firstSeen: new Date(),
          lastSeen: new Date()
        }
      })
    }
  }

  // ============================================
  // 3. 计算 AI 推荐概率（核心算法）
  // ============================================

  async calculateAIScore(citationId: string): Promise<CitationAnalysis> {
    const citation = await prisma.citation.findUnique({
      where: { id: citationId },
      include: { brand: true }
    })

    if (!citation) throw new Error('Citation not found')

    const sources = citation.sources as CitationSource[]
    const brandName = citation.brand.name

    // 构建分析 prompt
    const analysisPrompt = this.buildAnalysisPrompt(brandName, citation.promptText, citation.answerText, sources)

    // 调用 DeepSeek 分析
    const response = await chat([
      {
        role: 'system',
        content: `你是一个 AI 搜索优化专家。分析品牌在 AI 回答中的推荐情况，给出评分和改进建议。

请用 JSON 格式返回：
{
  "aiScore": 0-100 的分数,
  "confidence": 0-1 的置信度,
  "influences": [
    {
      "factor": "影响因子名称",
      "impact": -100 到 100 的影响值,
      "description": "具体说明"
    }
  ],
  "summary": "总体分析摘要"
}`
      },
      {
        role: 'user',
        content: analysisPrompt
      }
    ])

    // 解析 AI 返回
    const analysis = this.parseAnalysis(response)

    // 更新 Citation 记录
    await prisma.citation.update({
      where: { id: citationId },
      data: {
        aiScore: analysis.aiScore,
        confidence: analysis.confidence
      }
    })

    // 保存影响因子
    await this.saveInfluences(citationId, sources, analysis.influences)

    return {
      citationId,
      aiScore: analysis.aiScore,
      confidence: analysis.confidence,
      influences: analysis.influences,
      summary: analysis.summary
    }
  }

  // ============================================
  // 4. 构建分析 Prompt
  // ============================================

  private buildAnalysisPrompt(
    brandName: string,
    promptText: string,
    answerText: string,
    sources: CitationSource[]
  ): string {
    const sourceList = sources.map((s, i) => 
      `${i + 1}. ${s.title || 'No Title'}
   URL: ${s.url}
   Domain: ${this.extractDomain(s.url)}
   Snippet: ${s.snippet || 'N/A'}`
    ).join('\n\n')

    return `## 分析任务

评估品牌 "${brandName}" 在 AI 搜索回答中的推荐概率。

### 用户 Prompt
${promptText}

### AI 回答
${answerText}

### 引用来源（共 ${sources.length} 个）
${sourceList}

### 分析维度

请从以下维度评估：

1. **来源权威性** (权重 30%)
   - 来源域名的权威度（github.com, reddit.com > random-blog.com）
   - 来源类型（官方文档 > 论坛讨论 > 个人博客）

2. **引用相关性** (权重 25%)
   - 来源内容与用户问题的匹配度
   - 来源是否直接提及品牌

3. **品牌位置** (权重 20%)
   - 品牌在回答中的排名位置（1-3 位得分高）
   - 品牌被提及的上下文（推荐 vs 对比 vs 批评）

4. **内容丰富度** (权重 15%)
   - 引用来源的数量
   - 来源的多样性

5. **情感倾向** (权重 10%)
   - 品牌被提及的情感（正面 > 中性 > 负面）

### 输出要求

请给出：
- aiScore: 0-100 的综合分数
- confidence: 0-1 的置信度（数据越充分置信度越高）
- influences: 影响因子列表（至少 3 个，每个说明正/负面影响）
- summary: 一句话总结`
  }

  // ============================================
  // 5. 解析 AI 分析结果
  // ============================================

  private parseAnalysis(content: string): {
    aiScore: number
    confidence: number
    influences: InfluenceFactor[]
    summary: string
  } {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content
      const parsed = JSON.parse(jsonStr)

      return {
        aiScore: Math.max(0, Math.min(100, parsed.aiScore || 0)),
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        influences: Array.isArray(parsed.influences) ? parsed.influences : [],
        summary: parsed.summary || 'No summary'
      }
    } catch (error) {
      // 解析失败返回默认值
      return {
        aiScore: 50,
        confidence: 0.3,
        influences: [],
        summary: 'Unable to parse AI analysis'
      }
    }
  }

  // ============================================
  // 6. 保存影响因子
  // ============================================

  private async saveInfluences(
    citationId: string,
    sources: CitationSource[],
    influences: InfluenceFactor[]
  ): Promise<void> {
    for (const source of sources) {
      const domain = this.extractDomain(source.url)
      
      // 根据来源类型计算影响度
      const influenceScore = this.calculateSourceInfluence(domain, source)

      await prisma.citationInfluence.create({
        data: {
          citationId,
          sourceUrl: source.url,
          sourceDomain: domain,
          influence: influenceScore,
          factor: this.getSourceFactor(domain)
        }
      })
    }
  }

  // ============================================
  // 7. 计算来源影响度
  // ============================================

  private calculateSourceInfluence(domain: string, source: CitationSource): number {
    // 基础权重
    let weight = 50

    // 高权威域名加分
    const highAuthorityDomains = [
      'github.com', 'reddit.com', 'stackoverflow.com',
      'medium.com', 'dev.to', 'hashnode.dev',
      'arxiv.org', 'scholar.google.com'
    ]

    const mediumAuthorityDomains = [
      'wikipedia.org', 'linkedin.com', 'twitter.com',
      'producthunt.com', 'hackernews.com'
    ]

    if (highAuthorityDomains.includes(domain)) {
      weight += 30
    } else if (mediumAuthorityDomains.includes(domain)) {
      weight += 15
    }

    // 来源类型加分
    const sourceType = this.classifySource(domain)
    switch (sourceType) {
      case 'github':
        weight += 20
        break
      case 'reddit':
        weight += 15
        break
      case 'blog':
        weight += 10
        break
      case 'news':
        weight += 12
        break
      case 'forum':
        weight += 8
        break
    }

    return Math.min(100, weight)
  }

  // ============================================
  // 8. 来源分类
  // ============================================

  private classifySource(domain: string): string {
    const patterns: Record<string, RegExp[]> = {
      github: [/github\.com/i],
      reddit: [/reddit\.com/i],
      blog: [/medium\.com/i, /dev\.to/i, /hashnode\.dev/i, /blog/i],
      news: [/techcrunch\.com/i, /theverge\.com/i, /wired\.com/i, /arstechnica\.com/i],
      forum: [/stackoverflow\.com/i, /quora\.com/i, /forum/i],
      docs: [/docs\./i, /documentation/i, /readthedocs\.io/i],
      social: [/twitter\.com/i, /x\.com/i, /linkedin\.com/i, /facebook\.com/i]
    }

    for (const [type, regexes] of Object.entries(patterns)) {
      if (regexes.some(regex => regex.test(domain))) {
        return type
      }
    }

    return 'other'
  }

  // ============================================
  // 9. 提取域名
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
  // 10. 获取来源影响因子名称
  // ============================================

  private getSourceFactor(domain: string): string {
    const type = this.classifySource(domain)
    
    const factorMap: Record<string, string> = {
      github: 'github_star',
      reddit: 'reddit_upvote',
      blog: 'blog_authority',
      news: 'news_mention',
      forum: 'forum_discussion',
      docs: 'docs_reference',
      social: 'social_mention'
    }

    return factorMap[type] || 'other_source'
  }

  // ============================================
  // 11. 获取来源排行
  // ============================================

  async getSourceRankings(
    brandId: string,
    platform?: string,
    limit: number = 50
  ): Promise<SourceRanking[]> {
    const where: any = { brandId }
    if (platform) where.platform = platform

    const sources = await prisma.citationSource.findMany({
      where,
      orderBy: { weight: 'desc' },
      take: limit
    })

    return sources.map(s => ({
      domain: s.domain,
      url: s.url,
      title: s.title || '',
      sourceType: s.sourceType || 'other',
      weight: s.weight,
      citationCount: s.citationCount,
      influenceScore: s.weight * s.citationCount,
      sentiment: 'neutral' as const,
      firstSeen: s.firstSeen,
      lastSeen: s.lastSeen
    }))
  }

  // ============================================
  // 12. 生成影响力网络图
  // ============================================

  async generateNetworkGraph(
    brandId: string,
    limit: number = 100
  ): Promise<NetworkGraph> {
    const citations = await prisma.citation.findMany({
      where: { brandId },
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    const nodes: NetworkNode[] = []
    const edges: NetworkEdge[] = []
    const addedNodes = new Set<string>()
    const addedEdges = new Set<string>()

    // 添加品牌节点
    const brand = citations[0]?.brand
    if (brand) {
      nodes.push({
        id: `brand-${brand.id}`,
        label: brand.name,
        type: 'brand',
        size: 30,
        color: '#3B82F6'
      })
      addedNodes.add(`brand-${brand.id}`)
    }

    // 添加平台和来源节点
    for (const citation of citations) {
      const platformId = `platform-${citation.platform}`
      
      if (!addedNodes.has(platformId)) {
        nodes.push({
          id: platformId,
          label: citation.platform,
          type: 'platform',
          size: 20,
          color: '#10B981'
        })
        addedNodes.add(platformId)
      }

      // 品牌 -> 平台 边
      const brandEdgeKey = `brand-${brand?.id}-${platformId}`
      if (!addedEdges.has(brandEdgeKey) && brand) {
        edges.push({
          source: `brand-${brand.id}`,
          target: platformId,
          weight: 1,
          label: 'mentioned_on'
        })
        addedEdges.add(brandEdgeKey)
      }

      // 添加来源节点
      const sources = citation.sources as CitationSource[]
      for (const source of sources.slice(0, 5)) { // 限制每个 citation 最多 5 个来源
        const domain = this.extractDomain(source.url)
        const sourceId = `source-${domain}`

        if (!addedNodes.has(sourceId)) {
          nodes.push({
            id: sourceId,
            label: domain,
            type: 'source',
            size: 15,
            color: '#F59E0B'
          })
          addedNodes.add(sourceId)
        }

        // 平台 -> 来源 边
        const edgeKey = `${platformId}-${sourceId}`
        if (!addedEdges.has(edgeKey)) {
          edges.push({
            source: platformId,
            target: sourceId,
            weight: 1,
            label: 'cites'
          })
          addedEdges.add(edgeKey)
        }
      }
    }

    return { nodes, edges }
  }

  // ============================================
  // 13. 获取引用热力图数据
  // ============================================

  async getHeatmapData(
    brandId: string,
    days: number = 30
  ): Promise<{ date: string; count: number; score: number }[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const citations = await prisma.citation.findMany({
      where: {
        brandId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' }
    })

    // 按日期聚合
    const heatmap = new Map<string, { count: number; totalScore: number }>()

    for (const citation of citations) {
      const dateStr = citation.createdAt.toISOString().split('T')[0]
      const existing = heatmap.get(dateStr) || { count: 0, totalScore: 0 }
      
      existing.count++
      existing.totalScore += citation.aiScore || 0
      
      heatmap.set(dateStr, existing)
    }

    // 转换为数组
    return Array.from(heatmap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      score: data.count > 0 ? Math.round(data.totalScore / data.count) : 0
    }))
  }

  // ============================================
  // 14. 获取引用趋势
  // ============================================

  async getCitationTrend(
    brandId: string,
    platform?: string,
    days: number = 30
  ): Promise<{
    dates: string[]
    citationCounts: number[]
    aiScores: number[]
    sentimentDistribution: { positive: number; neutral: number; negative: number }
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const where: any = {
      brandId,
      createdAt: { gte: startDate }
    }
    if (platform) where.platform = platform

    const citations = await prisma.citation.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    })

    // 按日期聚合
    const dailyData = new Map<string, { count: number; totalScore: number }>()
    let positive = 0, neutral = 0, negative = 0

    for (const citation of citations) {
      const dateStr = citation.createdAt.toISOString().split('T')[0]
      const existing = dailyData.get(dateStr) || { count: 0, totalScore: 0 }
      
      existing.count++
      existing.totalScore += citation.aiScore || 0
      
      dailyData.set(dateStr, existing)

      // 情感统计
      const sentiment = this.analyzeSentiment(citation.answerText, citation.brand.name)
      if (sentiment === 'positive') positive++
      else if (sentiment === 'negative') negative++
      else neutral++
    }

    const sortedDates = Array.from(dailyData.keys()).sort()
    
    return {
      dates: sortedDates,
      citationCounts: sortedDates.map(d => dailyData.get(d)!.count),
      aiScores: sortedDates.map(d => Math.round(dailyData.get(d)!.totalScore / dailyData.get(d)!.count)),
      sentimentDistribution: { positive, neutral, negative }
    }
  }

  // ============================================
  // 15. 情感分析（简化版）
  // ============================================

  private analyzeSentiment(text: string, brandName: string): 'positive' | 'neutral' | 'negative' {
    const lowerText = text.toLowerCase()
    const lowerBrand = brandName.toLowerCase()

    // 正面关键词
    const positiveWords = ['best', 'top', 'recommended', 'excellent', 'great', 'good', 'love', 'amazing', 'awesome', 'popular']
    // 负面关键词
    const negativeWords = ['worst', 'bad', 'poor', 'terrible', 'hate', 'disappointing', 'issue', 'problem', 'bug']

    const brandIndex = lowerText.indexOf(lowerBrand)
    if (brandIndex === -1) return 'neutral'

    // 检查品牌附近的关键词
    const context = lowerText.substring(Math.max(0, brandIndex - 100), Math.min(lowerText.length, brandIndex + lowerBrand.length + 100))
    
    const hasPositive = positiveWords.some(word => context.includes(word))
    const hasNegative = negativeWords.some(word => context.includes(word))

    if (hasPositive && !hasNegative) return 'positive'
    if (hasNegative && !hasPositive) return 'negative'
    return 'neutral'
  }

  // ============================================
  // 16. 批量分析
  // ============================================

  async batchAnalyze(citationIds: string[]): Promise<CitationAnalysis[]> {
    const results: CitationAnalysis[] = []

    for (const citationId of citationIds) {
      try {
        const analysis = await this.calculateAIScore(citationId)
        results.push(analysis)
      } catch (error) {
        console.error(`Failed to analyze citation ${citationId}:`, error)
      }
    }

    return results
  }

  // ============================================
  // 17. 获取统计数据
  // ============================================

  async getStats(brandId: string): Promise<{
    totalCitations: number
    avgAiScore: number
    topPlatform: string
    topSource: string
    recentTrend: 'up' | 'down' | 'stable'
  }> {
    const totalCitations = await prisma.citation.count({
      where: { brandId }
    })

    const avgResult = await prisma.citation.aggregate({
      where: { brandId },
      _avg: { aiScore: true }
    })

    // 获取平台分布
    const platformStats = await prisma.citation.groupBy({
      by: ['platform'],
      where: { brandId },
      _count: true,
      orderBy: { _count: { platform: 'desc' } }
    })

    // 获取来源排行
    const topSource = await prisma.citationSource.findFirst({
      where: { brandId },
      orderBy: { citationCount: 'desc' }
    })

    // 计算趋势（最近 7 天 vs 之前 7 天）
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const recentCount = await prisma.citation.count({
      where: { brandId, createdAt: { gte: weekAgo } }
    })

    const previousCount = await prisma.citation.count({
      where: {
        brandId,
        createdAt: { gte: twoWeeksAgo, lt: weekAgo }
      }
    })

    let recentTrend: 'up' | 'down' | 'stable' = 'stable'
    if (recentCount > previousCount * 1.1) recentTrend = 'up'
    else if (recentCount < previousCount * 0.9) recentTrend = 'down'

    return {
      totalCitations,
      avgAiScore: Math.round(avgResult._avg.aiScore || 0),
      topPlatform: platformStats[0]?.platform || 'N/A',
      topSource: topSource?.domain || 'N/A',
      recentTrend
    }
  }
}

// 导出单例
export const citationEngine = new CitationEngine()
