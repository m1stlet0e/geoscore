// ============================================
// GET /api/publish — list publish jobs
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
    const contentId = searchParams.get('contentId') || undefined
    const status = searchParams.get('status') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20

    const result = await contentEngine.getPublishJobs(userId, contentId, status, page, limit)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /api/publish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
