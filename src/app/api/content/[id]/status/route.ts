// ============================================
// PUT /api/content/[id]/status — update content status
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'

const VALID_STATUSES = ['draft', 'review', 'approved', 'published', 'archived'] as const

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const updated = await contentEngine.updateContentStatus(id, user.id, status)

    if (!updated) {
      return NextResponse.json({ error: 'Content not found or update failed' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/content/[id]/status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
