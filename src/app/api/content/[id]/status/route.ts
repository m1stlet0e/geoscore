// ============================================
// PUT /api/content/[id]/status — update content status
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'

const VALID_STATUSES = ['draft', 'review', 'approved', 'published', 'archived'] as const

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const updated = await contentEngine.updateContentStatus(id, userId, status)

    if (!updated) {
      return NextResponse.json({ error: 'Content not found or update failed' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/content/[id]/status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
