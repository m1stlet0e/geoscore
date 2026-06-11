// ============================================
// POST /api/content/[id]/publish — create publish job
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'

const VALID_CHANNELS = ['wordpress', 'notion', 'reddit', 'github', 'zhihu', 'wechat'] as const

export async function POST(
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
    const { channel } = body

    if (!channel || !VALID_CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` },
        { status: 400 }
      )
    }

    const publishJob = await contentEngine.createPublishJob(id, user.id, channel)

    return NextResponse.json({ success: true, data: publishJob }, { status: 201 })
  } catch (error) {
    console.error('POST /api/content/[id]/publish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
