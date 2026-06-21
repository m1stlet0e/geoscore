// ============================================
// GET /api/content — list contents
// POST /api/content — generate content
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'
import type { ContentType } from '@/lib/engines/content.engine'

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

    const type = searchParams.get('type') as ContentType | undefined || undefined
    const status = searchParams.get('status') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20

    const result = await contentEngine.getContents(brandId, userId, type, status, page, limit)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /api/content error:', error)
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
    const { brandId, type, topic, targetKeyword, gapItemId, competitorName, tone, length } = body

    if (!brandId || !type || !topic) {
      return NextResponse.json({ error: 'brandId, type, and topic are required' }, { status: 400 })
    }

    const content = await contentEngine.generateContent({
      brandId,
      userId: userId,
      type,
      topic,
      targetKeyword,
      gapItemId,
      competitorName,
      tone,
      length,
    })

    return NextResponse.json({ success: true, data: content }, { status: 201 })
  } catch (error) {
    console.error('POST /api/content error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
