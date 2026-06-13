import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { gapIntelligenceEngine } from '@/lib/engines/gap-intelligence.engine'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
    }

    // Verify brand belongs to user
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, userId: user.id },
    })
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const data = await gapIntelligenceEngine.getGapReport(brandId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[GAP_SUMMARY_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
