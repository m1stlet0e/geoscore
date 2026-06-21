// ============================================
// GET /api/citations/sources/[domain]
// 获取单个来源详情
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ domain: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const { domain } = await ctx.params
    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json(
        { error: 'brandId is required' },
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

    // 获取来源详情
    const sources = await prisma.citationSource.findMany({
      where: {
        brandId,
        domain
      },
      orderBy: { lastSeen: 'desc' }
    })

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      )
    }

    // 聚合统计
    const totalCitations = sources.reduce((sum, s) => sum + s.citationCount, 0)
    const avgWeight = sources.reduce((sum, s) => sum + s.weight, 0) / sources.length

    return NextResponse.json({
      success: true,
      data: {
        domain,
        sources,
        stats: {
          totalCitations,
          avgWeight: Math.round(avgWeight * 100) / 100,
          platforms: [...new Set(sources.map(s => s.platform))],
          firstSeen: sources[sources.length - 1].firstSeen,
          lastSeen: sources[0].lastSeen
        }
      }
    })
  } catch (error) {
    console.error('GET /api/citations/sources/[domain] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
