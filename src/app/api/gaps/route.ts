import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { gapEngine } from '@/lib/engines/gap.engine'
import { quotaService } from '@/lib/billing/quota.service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    }

    // Verify brand belongs to user
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, userId: userId },
    })
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const data = await gapEngine.getAnalyses(brandId, userId, page, limit)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GAP_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const body = await request.json()
    const { brandId, platform, promptText, competitorId } = body

    if (!brandId || !platform || !promptText) {
      return NextResponse.json(
        { error: 'brandId, platform, and promptText are required' },
        { status: 400 }
      )
    }

    // Verify brand belongs to user
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, userId: userId },
    })
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const canProceed = await quotaService.checkAndDeduct(
      userId,
      'GAP_ANALYSIS',
      1,
      undefined,
      { brandId, platform, promptText }
    )
    if (!canProceed) {
      return NextResponse.json(
        { error: 'Gap 分析配额不足或会员已过期，请升级套餐' },
        { status: 403 }
      )
    }

    const data = await gapEngine.analyzeGap(brandId, userId, platform, promptText, competitorId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GAP_POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
