import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { billingService } from '@/lib/billing/billing.service'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const body = await request.json()
    const { plan, paymentMethod } = body as { plan: 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE'; paymentMethod: 'wechat' | 'alipay' }

    if (!plan || !['FREE', 'PRO', 'GROWTH', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    if (!paymentMethod || !['wechat', 'alipay'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    const result = await billingService.createOrder(userId, plan, paymentMethod)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
