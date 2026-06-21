// ============================================
// GET /api/quota
// 获取用户额度
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { billingService } from '@/lib/billing/billing.service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id

    const quotas = await billingService.getQuotas(userId)

    return NextResponse.json({
      success: true,
      data: { quotas }
    })
  } catch (error) {
    console.error('GET /api/quota error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
