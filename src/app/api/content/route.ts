// ============================================
// GET /api/content — list contents
// POST /api/content — generate content
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { contentEngine } from '@/lib/engines/content.engine'
import type { ContentType } from '@/lib/engines/content.engine'

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

    const type = searchParams.get('type') as ContentType | undefined || undefined
    const status = searchParams.get('status') || undefined
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20

    const result = await contentEngine.getContents(brandId, user.id, type, status, page, limit)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('GET /api/content error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { brandId, type, topic, targetKeyword, gapItemId, competitorName, tone, length } = body

    if (!brandId || !type || !topic) {
      return NextResponse.json({ error: 'brandId, type, and topic are required' }, { status: 400 })
    }

    const content = await contentEngine.generateContent({
      brandId,
      userId: user.id,
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
