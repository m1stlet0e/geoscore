// ============================================
// GET /api/citations/[id]
// 获取单条引用详情
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const { id } = await ctx.params

    // 获取引用详情
    const citation = await prisma.citation.findFirst({
      where: {
        id,
        userId: userId
      },
      include: {
        brand: {
          select: { id: true, name: true, domain: true }
        },
        citationInfluences: {
          orderBy: { influence: 'desc' }
        }
      }
    })

    if (!citation) {
      return NextResponse.json(
        { error: 'Citation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: citation
    })
  } catch (error) {
    console.error('GET /api/citations/[id] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
