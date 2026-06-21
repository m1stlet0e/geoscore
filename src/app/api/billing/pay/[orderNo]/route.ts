import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { billingService } from '@/lib/billing/billing.service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id as string

    const { orderNo } = await params

    // Verify the order belongs to the user
    const order = await prisma.order.findFirst({
      where: { orderNo, userId: userId },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: '生产环境请使用 Payjs/微信/支付宝收银台完成支付' },
        { status: 403 }
      )
    }

    // 开发环境模拟支付（仅本地联调）
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
