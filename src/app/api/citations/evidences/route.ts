// ============================================
// GET /api/citations/evidences
// 获取证据列表 (Citation Intelligence 2.0)
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
    const platform = searchParams.get('platform') || undefined
    const sourceType = searchParams.get('sourceType') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

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

    const result = await citationEngine.getEvidences(
      brandId,
      userId,
      platform,
      sourceType,
      page,
      limit
    )

    return NextResponse.json({
      success: true,
      data: result.evidences,
      pagination: result.pagination
    })
  } catch (error) {
    console.error('GET /api/citations/evidences error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
