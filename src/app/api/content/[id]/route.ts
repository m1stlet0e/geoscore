// ============================================
// GET /api/content/[id] — content detail
// PUT /api/content/[id] — update content
// DELETE /api/content/[id] — delete content
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'

export async function GET(
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

    const content = await contentEngine.getContentDetail(id, userId)

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: content })
  } catch (error) {
    console.error('GET /api/content/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const { title, body: contentBody } = body

    const updated = await contentEngine.updateContent(id, userId, { title, body: contentBody })

    if (!updated) {
      return NextResponse.json({ error: 'Content not found or update failed' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PUT /api/content/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    const deleted = await contentEngine.deleteContent(id, userId)

    if (!deleted) {
      return NextResponse.json({ error: 'Content not found or delete failed' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/content/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
