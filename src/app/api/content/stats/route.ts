// ============================================
// GET /api/content/stats — content statistics
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'

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

    const stats = await contentEngine.getStats(brandId, userId)

    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    console.error('GET /api/content/stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
