// ============================================
// GET /api/citations/factors
// 获取因素分布 (Citation Intelligence 2.0)
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { recommendationFactorEngine } from '@/lib/engines/recommendation-factor.engine'

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
        userId: user.id
      }
    })

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found or access denied' },
        { status: 404 }
      )
    }

    const result = await recommendationFactorEngine.getFactors(brandId)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('GET /api/citations/factors error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
