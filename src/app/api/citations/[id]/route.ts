// ============================================
// GET /api/citations/[id]
// 获取单条引用详情
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { id } = await ctx.params

    // 获取引用详情
    const citation = await prisma.citation.findFirst({
      where: {
        id,
        userId: user.id
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
