// ============================================
// GET /api/citations
// 获取引用记录列表
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // 验证登录
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    const platform = searchParams.get('platform')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // 构建查询条件
    const where: any = { userId: userId }
    if (brandId) where.brandId = brandId
    if (platform) where.platform = platform

    // 获取总数
    const total = await prisma.citation.count({ where })

    // 获取列表
    const citations = await prisma.citation.findMany({
      where,
      include: {
        brand: {
          select: { id: true, name: true }
        },
        citationInfluences: {
          orderBy: { influence: 'desc' },
          take: 5
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: {
        citations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('GET /api/citations error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
