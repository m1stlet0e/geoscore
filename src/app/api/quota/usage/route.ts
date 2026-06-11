// ============================================
// GET /api/quota/usage
// 获取额度用量明细
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 获取用户的额度
    const quotaWhere: any = {
      userId: user.id,
      period: 'monthly',
      periodStart,
    }
    if (type) quotaWhere.type = type

    const quotas = await prisma.quota.findMany({
      where: quotaWhere,
    })

    const quotaIds = quotas.map(q => q.id)

    // 获取用量记录
    const total = await prisma.quotaUsage.count({
      where: { quotaId: { in: quotaIds } },
    })

    const usages = await prisma.quotaUsage.findMany({
      where: { quotaId: { in: quotaIds } },
      include: {
        quota: {
          select: { type: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json({
      success: true,
      data: {
        usages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('GET /api/quota/usage error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
