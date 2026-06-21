// ============================================
// GET /api/citations/heatmap
// 获取引用热力图数据
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { citationEngine } from '@/lib/engines/citation.engine'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    const days = parseInt(searchParams.get('days') || '30')

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

    // 获取统计数据
    const stats = await citationEngine.getStats(brandId)

    return NextResponse.json({
      success: true,
      data: {
        heatmap: stats,
        totalDays: days
      }
    })
  } catch (error) {
    console.error('GET /api/citations/heatmap error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
