// ============================================
// Content Generation Engine
// GEO Agent: 自动生成优化内容
// ============================================

import { prisma } from '@/lib/prisma'
import { chat, jsonChat, chatCompletion } from '@/lib/deepseek'
import { billingService } from '@/lib/billing/billing.service'

// ============================================
// Types
// ============================================

export type ContentType = 
  | 'FAQ'
  | 'COMPARISON'
  | 'USE_CASE'
  | 'SCHEMA'
  | 'BLOG_POST'
  | 'REDDIT_POST'
  | 'GITHUB_README'
  | 'ZHIHU_ANSWER'
  | 'WECHAT_ARTICLE'
  | 'MEDIA_PITCH'

export interface ContentRequest {
  brandId: string
  userId: string
  type: ContentType
  topic: string
  targetKeyword?: string
  gapItemId?: string
  competitorName?: string
  tone?: 'professional' | 'casual' | 'technical' | 'marketing'
  length?: 'short' | 'medium' | 'long'
}

export interface GeneratedContent {
  contentId: string
  type: ContentType
  title: string
  body: string
  quality: number
  meta: Record<string, any>
}

export interface ContentSummary {
  totalPieces: number
  publishedCount: number
  draftCount: number
  avgQuality: number
  topType: string
  recentTrend: 'increasing' | 'decreasing' | 'stable'
}

// ============================================
// Content Type Config
// ============================================

const CONTENT_TYPE_CONFIG: Record<ContentType, {
  name: string
  description: string
  icon: string
  defaultLength: 'short' | 'medium' | 'long'
  wordCount: { short: number; medium: number; long: number }
}> = {
  FAQ: {
    name: 'FAQ 问答',
    description: '针对常见问题的结构化回答',
    icon: '❓',
    defaultLength: 'short',
    wordCount: { short: 200, medium: 400, long: 600 },
  },
  COMPARISON: {
    name: '对比评测',
    description: '产品对比分析文章',
    icon: '⚖️',
    defaultLength: 'medium',
    wordCount: { short: 500, medium: 1000, long: 1500 },
  },
  USE_CASE: {
    name: '使用案例',
    description: '实际使用场景和案例',
    icon: '💡',
    defaultLength: 'medium',
    wordCount: { short: 400, medium: 800, long: 1200 },
  },
  SCHEMA: {
    name: 'Schema 标记',
    description: '结构化数据 JSON-LD',
    icon: '🔧',
    defaultLength: 'short',
    wordCount: { short: 100, medium: 200, long: 300 },
  },
  BLOG_POST: {
    name: '博客文章',
    description: 'SEO 优化的博客内容',
    icon: '📝',
    defaultLength: 'long',
    wordCount: { short: 800, medium: 1500, long: 2500 },
  },
  REDDIT_POST: {
    name: 'Reddit 帖子',
    description: 'Reddit 社区讨论内容',
    icon: '📱',
    defaultLength: 'medium',
    wordCount: { short: 300, medium: 600, long: 1000 },
  },
  GITHUB_README: {
    name: 'GitHub README',
    description: '开源项目文档',
    icon: '🐙',
    defaultLength: 'medium',
    wordCount: { short: 500, medium: 1000, long: 2000 },
  },
  ZHIHU_ANSWER: {
    name: '知乎回答',
    description: '知乎问答平台内容',
    icon: '💬',
    defaultLength: 'medium',
    wordCount: { short: 500, medium: 1000, long: 2000 },
  },
  WECHAT_ARTICLE: {
    name: '微信公众号',
    description: '微信公众号文章',
    icon: '📱',
    defaultLength: 'long',
    wordCount: { short: 1000, medium: 2000, long: 3000 },
  },
  MEDIA_PITCH: {
    name: '媒体稿件',
    description: '新闻稿/PR 稿',
    icon: '📰',
    defaultLength: 'medium',
    wordCount: { short: 500, medium: 800, long: 1200 },
  },
}

// ============================================
// Core Engine Class
// ============================================

export class ContentEngine {
  // ============================================
  // 1. 生成内容
  // ============================================

  async generateContent(request: ContentRequest): Promise<GeneratedContent> {
    // 检查额度
    const quotaCheck = await billingService.checkQuota(request.userId, 'CONTENT_GENERATE')
    if (!quotaCheck.allowed) {
      throw new Error(`额度不足，剩余 ${quotaCheck.remaining} 次`)
    }

    // 获取品牌信息
    const brand = await prisma.brand.findUnique({
      where: { id: request.brandId },
    })

    if (!brand) throw new Error('Brand not found')

    // 获取 Gap 项信息（如果有）
    let gapContext = ''
    if (request.gapItemId) {
      const gapItem = await prisma.gapItem.findUnique({
        where: { id: request.gapItemId },
      })
      if (gapItem) {
        gapContext = `\n\n差距分析：${gapItem.title}\n${gapItem.description}`
      }
    }

    // 生成内容
    const config = CONTENT_TYPE_CONFIG[request.type]
    const length = request.length || config.defaultLength
    const wordCount = config.wordCount[length]

    const prompt = this.buildPrompt(
      request.type,
      brand.name,
      brand.category || 'SaaS',
      request.topic,
      request.targetKeyword || '',
      request.competitorName || '',
      request.tone || 'professional',
      wordCount,
      gapContext
    )

    const response = await chatCompletion([
      {
        role: 'system',
        content: this.getSystemPrompt(request.type),
      },
      {
        role: 'user',
        content: prompt,
      },
    ])

    // 解析生成的内容
    const { title, body, quality } = this.parseContent(response, request.type)

    // 保存到数据库
    const content = await prisma.contentPiece.create({
      data: {
        brandId: request.brandId,
        userId: request.userId,
        type: request.type,
        title,
        body,
        quality,
        status: 'draft',
        meta: {
          topic: request.topic,
          targetKeyword: request.targetKeyword,
          gapItemId: request.gapItemId,
          competitorName: request.competitorName,
          tone: request.tone,
          length,
          wordCount,
          generatedBy: 'deepseek',
        },
      },
    })

    // 消费额度
    await billingService.consumeQuota(
      request.userId,
      'CONTENT_GENERATE',
      1,
      `Generated ${request.type} content: ${title}`,
      { contentId: content.id, type: request.type }
    )

    return {
      contentId: content.id,
      type: request.type,
      title,
      body,
      quality,
      meta: content.meta as Record<string, any>,
    }
  }

  // ============================================
  // 2. 构建 Prompt
  // ============================================

  private buildPrompt(
    type: ContentType,
    brandName: string,
    brandCategory: string,
    topic: string,
    targetKeyword: string,
    competitorName: string,
    tone: string,
    wordCount: number,
    gapContext: string
  ): string {
    const competitorSection = competitorName
      ? `\n竞品：${competitorName}`
      : ''

    const keywordSection = targetKeyword
      ? `\n目标关键词：${targetKeyword}`
      : ''

    return `## 内容生成任务

品牌：${brandName} (${brandCategory})
类型：${CONTENT_TYPE_CONFIG[type].name}
主题：${topic}${keywordSection}${competitorSection}
语气：${tone}
目标字数：约 ${wordCount} 字${gapContext}

### 要求

1. 内容必须围绕品牌 "${brandName}" 展开
2. 自然融入品牌优势和特点
3. 符合 ${type} 类型的内容规范
4. 语言流畅，适合目标受众
5. 包含具体的例子和数据（可以合理推测）
6. SEO 友好，自然包含相关关键词

### 输出格式

请用以下格式输出：

标题：[文章标题]

[正文内容]`
  }

  // ============================================
  // 3. 获取系统 Prompt
  // ============================================

  private getSystemPrompt(type: ContentType): string {
    const basePrompt = '你是一个专业的 GEO (Generative Engine Optimization) 内容创作专家。'

    const typePrompts: Record<ContentType, string> = {
      FAQ: `${basePrompt} 擅长编写简洁明了的问答内容，直接回答用户问题，同时自然融入品牌信息。`,
      COMPARISON: `${basePrompt} 擅长编写客观公正的产品对比分析，突出品牌优势但不贬低竞品。`,
      USE_CASE: `${basePrompt} 擅长描述实际使用场景，通过具体案例展示品牌价值。`,
      SCHEMA: `${basePrompt} 擅长编写 JSON-LD 结构化数据，帮助搜索引擎和 AI 更好地理解内容。`,
      BLOG_POST: `${basePrompt} 擅长撰写深度技术博客，兼顾专业性和可读性。`,
      REDDIT_POST: `${basePrompt} 擅长编写社区风格的内容，自然不突兀地推荐品牌。`,
      GITHUB_README: `${basePrompt} 擅长编写清晰的技术文档，让开发者快速了解项目价值。`,
      ZHIHU_ANSWER: `${basePrompt} 擅长编写知乎风格的长回答，专业且有深度。`,
      WECHAT_ARTICLE: `${basePrompt} 擅长编写微信公众号文章，适合中文读者阅读习惯。`,
      MEDIA_PITCH: `${basePrompt} 擅长编写新闻稿，突出新闻价值和品牌亮点。`,
    }

    return typePrompts[type] || basePrompt
  }

  // ============================================
  // 4. 解析生成的内容
  // ============================================

  private parseContent(response: string, type: ContentType): {
    title: string
    body: string
    quality: number
  } {
    // 提取标题
    const titleMatch = response.match(/标题[：:]\s*(.+)/)
    const title = titleMatch ? titleMatch[1].trim() : `Generated ${type} Content`

    // 提取正文（去掉标题行）
    let body = response
    if (titleMatch) {
      body = response.replace(titleMatch[0], '').trim()
    }

    // 计算质量分数（基于字数、结构等）
    const wordCount = body.length
    let quality = 70

    // 字数达标 +5
    if (wordCount > 200) quality += 5
    if (wordCount > 500) quality += 5
    if (wordCount > 1000) quality += 5

    // 有结构化内容 +5
    if (body.includes('##') || body.includes('- ') || body.includes('1.')) quality += 5

    // 有品牌提及 +5
    if (body.length > 0) quality += 5

    return {
      title,
      body,
      quality: Math.min(100, quality),
    }
  }

  // ============================================
  // 5. 获取内容列表
  // ============================================

  async getContents(
    brandId: string,
    userId: string,
    type?: ContentType,
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    contents: any[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const where: any = { brandId, userId }
    if (type) where.type = type
    if (status) where.status = status

    const total = await prisma.contentPiece.count({ where })

    const contents = await prisma.contentPiece.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      contents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  // ============================================
  // 6. 获取内容详情
  // ============================================

  async getContentDetail(contentId: string, userId: string): Promise<any | null> {
    return prisma.contentPiece.findFirst({
      where: {
        id: contentId,
        userId,
      },
      include: {
        publishJobs: true,
        brand: {
          select: { id: true, name: true },
        },
      },
    })
  }

  // ============================================
  // 7. 更新内容状态
  // ============================================

  async updateContentStatus(
    contentId: string,
    userId: string,
    status: 'draft' | 'review' | 'approved' | 'published' | 'archived'
  ): Promise<boolean> {
    const content = await prisma.contentPiece.findFirst({
      where: {
        id: contentId,
        userId,
      },
    })

    if (!content) return false

    await prisma.contentPiece.update({
      where: { id: contentId },
      data: {
        status,
        ...(status === 'published' ? { publishedAt: new Date() } : {}),
      },
    })

    return true
  }

  // ============================================
  // 8. 编辑内容
  // ============================================

  async updateContent(
    contentId: string,
    userId: string,
    updates: { title?: string; body?: string }
  ): Promise<boolean> {
    const content = await prisma.contentPiece.findFirst({
      where: {
        id: contentId,
        userId,
      },
    })

    if (!content) return false

    await prisma.contentPiece.update({
      where: { id: contentId },
      data: updates,
    })

    return true
  }

  // ============================================
  // 9. 删除内容
  // ============================================

  async deleteContent(contentId: string, userId: string): Promise<boolean> {
    const content = await prisma.contentPiece.findFirst({
      where: {
        id: contentId,
        userId,
      },
    })

    if (!content) return false

    await prisma.contentPiece.delete({
      where: { id: contentId },
    })

    return true
  }

  // ============================================
  // 10. 创建发布任务
  // ============================================

  async createPublishJob(
    contentId: string,
    userId: string,
    channel: string
  ): Promise<any> {
    // 验证内容属于用户
    const content = await prisma.contentPiece.findFirst({
      where: {
        id: contentId,
        userId,
      },
    })

    if (!content) throw new Error('Content not found')

    // 创建发布任务
    const job = await prisma.publishJob.create({
      data: {
        contentId,
        userId,
        channel,
        status: 'pending',
      },
    })

    // 模拟发布（实际需要对接各平台 API）
    this.simulatePublish(job.id, channel)

    return job
  }

  // ============================================
  // 11. 模拟发布（Demo）
  // ============================================

  private async simulatePublish(jobId: string, channel: string): Promise<void> {
    // 更新状态为进行中
    await prisma.publishJob.update({
      where: { id: jobId },
      data: { status: 'in_progress' },
    })

    // 模拟延迟
    setTimeout(async () => {
      // 生成模拟 URL
      const mockUrls: Record<string, string> = {
        wordpress: `https://blog.example.com/post/${Date.now()}`,
        notion: `https://notion.so/page/${Date.now()}`,
        reddit: `https://reddit.com/r/seo/comments/${Date.now()}`,
        github: `https://github.com/example/repo/pull/${Date.now()}`,
        zhihu: `https://zhihu.com/question/123/answer/${Date.now()}`,
        wechat: `https://mp.weixin.qq.com/s/${Date.now()}`,
      }

      const externalUrl = mockUrls[channel] || `https://example.com/published/${Date.now()}`

      // 更新为已完成
      await prisma.publishJob.update({
        where: { id: jobId },
        data: {
          status: 'published',
          externalUrl,
          completedAt: new Date(),
          response: { success: true, url: externalUrl },
        },
      })

      // 更新内容状态
      const job = await prisma.publishJob.findUnique({
        where: { id: jobId },
      })

      if (job) {
        await prisma.contentPiece.update({
          where: { id: job.contentId },
          data: {
            status: 'published',
            publishedAt: new Date(),
          },
        })
      }
    }, 3000) // 3 秒后完成
  }

  // ============================================
  // 12. 获取发布任务列表
  // ============================================

  async getPublishJobs(
    userId: string,
    contentId?: string,
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    jobs: any[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const where: any = { userId }
    if (contentId) where.contentId = contentId
    if (status) where.status = status

    const total = await prisma.publishJob.count({ where })

    const jobs = await prisma.publishJob.findMany({
      where,
      include: {
        content: {
          select: { id: true, title: true, type: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  // ============================================
  // 13. 获取统计信息
  // ============================================

  async getStats(brandId: string, userId: string): Promise<ContentSummary> {
    const contents = await prisma.contentPiece.findMany({
      where: { brandId, userId },
    })

    const totalPieces = contents.length

    if (totalPieces === 0) {
      return {
        totalPieces: 0,
        publishedCount: 0,
        draftCount: 0,
        avgQuality: 0,
        topType: 'N/A',
        recentTrend: 'stable',
      }
    }

    const publishedCount = contents.filter(c => c.status === 'published').length
    const draftCount = contents.filter(c => c.status === 'draft').length
    const avgQuality = contents.reduce((sum, c) => sum + (c.quality || 0), 0) / totalPieces

    // 最常见的类型
    const typeCounts = new Map<string, number>()
    for (const c of contents) {
      typeCounts.set(c.type, (typeCounts.get(c.type) || 0) + 1)
    }
    const topType = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    // 趋势分析（最近 7 天 vs 之前 7 天）
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const recentCount = contents.filter(c => c.createdAt >= weekAgo).length
    const previousCount = contents.filter(c => c.createdAt >= twoWeeksAgo && c.createdAt < weekAgo).length

    let recentTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (recentCount > previousCount * 1.2) recentTrend = 'increasing'
    else if (recentCount < previousCount * 0.8) recentTrend = 'decreasing'

    return {
      totalPieces,
      publishedCount,
      draftCount,
      avgQuality: Math.round(avgQuality),
      topType,
      recentTrend,
    }
  }

  // ============================================
  // 14. 获取内容类型配置
  // ============================================

  getContentTypeConfig(): typeof CONTENT_TYPE_CONFIG {
    return CONTENT_TYPE_CONFIG
  }
}

// 导出单例
export const contentEngine = new ContentEngine()
