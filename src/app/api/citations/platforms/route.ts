// ============================================
// GET /api/citations/platforms
// 获取平台列表 + 统计 (Citation Intelligence 2.0)
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { citationEngine } from '@/lib/engines/citation.engine'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId') || undefined

    // 获取平台列表（公开数据）
    const platforms = citationEngine.getPlatforms()

    // 如果提供了 brandId，获取该品牌的平台统计数据
    let stats = null
    if (brandId) {
      const brand = await prisma.brand.findFirst({
        where: {
          id: brandId,
          userId: user.id
        }
      })

      if (brand) {
        stats = await citationEngine.getPlatformStats(brandId)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        platforms,
        stats
      }
    })
  } catch (error) {
    console.error('GET /api/citations/platforms error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
