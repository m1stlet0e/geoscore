// ============================================
// POST /api/content/[id]/publish — create publish job
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'

const VALID_CHANNELS = ['wordpress', 'notion', 'zhihu', 'gitee', 'segmentfault', 'wechat'] as const

export async function POST(
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
    const { channel } = body

    if (!channel || !VALID_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` },
        { status: 400 }
      )
    }

    const publishJob = await contentEngine.createPublishJob(id, userId, channel)

    return NextResponse.json({ success: true, data: publishJob }, { status: 201 })
  } catch (error) {
    console.error('POST /api/content/[id]/publish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
