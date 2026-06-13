import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { citationEngine } from '@/lib/engines/citation.engine'
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
    const platform = searchParams.get('platform') || undefined

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

    const distribution = await citationEngine.getFactorDistribution(brandId, platform)
    if (distribution.length > 0) {
      return NextResponse.json({ success: true, data: distribution })
    }

    const report = await recommendationFactorEngine.getFactors(brandId)
    const factors = report.factors ?? []
    const totalWeight =
      factors.reduce((sum, f) => sum + Math.abs(f.impact || f.weight || 0), 0) || 1
    const mapped = factors.map((f) => ({
      factor: f.factor,
      label: f.factor,
      count: f.mentions ?? 1,
      totalWeight: f.weight ?? 0,
      avgWeight: f.weight ?? 0,
      percentage: (Math.abs(f.impact || f.weight || 0) / totalWeight) * 100,
    }))

    return NextResponse.json({
      success: true,
      data: mapped,
    })
  } catch (error) {
    console.error('GET /api/citations/factors error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
