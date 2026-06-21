import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { gapEngine } from '@/lib/engines/gap.engine'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')

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

    const summary = await gapEngine.getSummary(brandId, userId)
    const data = {
      ...summary,
      trend:
        summary.trend === 'improving'
          ? 'up'
          : summary.trend === 'worsening'
            ? 'down'
            : 'stable',
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GAP_SUMMARY_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
