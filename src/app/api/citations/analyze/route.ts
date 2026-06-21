// ============================================
// POST /api/citations/analyze
// 分析推荐因素 (Citation Intelligence 2.0)
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { citationEngine } from '@/lib/engines/citation.engine'
import { quotaService } from '@/lib/billing/quota.service'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const body = await request.json()
    const { brandId, platform, prompt, answer, sources } = body

    // 参数校验
    if (!brandId || !platform || !prompt || !answer) {
      return NextResponse.json(
        { error: 'brandId, platform, prompt, and answer are required' },
        { status: 400 }
      )
    }

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { error: 'sources array is required and must not be empty' },
        { status: 400 }
      )
    }

    // 验证品牌属于当前用户
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        userId: userId
      }
    })

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 404 }
      )
    }

    const canProceed = await quotaService.checkAndDeduct(
      userId,
      'CITATION_ANALYSIS',
      1,
      undefined,
      { brandId, platform, prompt }
    )
    if (!canProceed) {
      return NextResponse.json(
        { error: 'Citation 分析配额不足或会员已过期，请升级套餐' },
        { status: 403 }
      )
    }

    // 分析推荐因素
    const result = await citationEngine.analyzeRecommendationFactors(
      brandId,
      userId,
      platform,
      prompt,
      answer,
      sources
    )

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('POST /api/citations/analyze error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
