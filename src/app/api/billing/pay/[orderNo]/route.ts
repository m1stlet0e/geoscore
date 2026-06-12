import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'
import { billingService } from '@/lib/billing/billing.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
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

    const { orderNo } = await params

    // Verify the order belongs to the user
    const order = await prisma.order.findFirst({
      where: { orderNo, userId: user.id },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Mock payment: auto-complete for demo purposes
    const transactionId = 'mock_txn_' + Date.now()
    const method = (order.paymentMethod || 'wechat') as 'wechat' | 'alipay'

    const result = await billingService.handlePaymentCallback(orderNo, transactionId, method)

    if (!result) {
      return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, transactionId })
  } catch (error) {
    console.error('Error initiating payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
