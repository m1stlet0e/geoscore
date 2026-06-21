// ============================================
// Payjs 支付回调（验签 + 金额校验 + 幂等）
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { paymentService } from '@/lib/payment'
import { billingService } from '@/lib/billing/billing.service'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}

    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    if (!paymentService.verifyCallback(params)) {
      console.error('Payjs callback signature verification failed')
      return new NextResponse('签名验证失败', { status: 400 })
    }

    if (params.status !== '1') {
      return new NextResponse('success')
    }

    const orderNo = params.out_trade_no
    const payjsOrderId = params.payjs_order_id
    const totalFee = Number(params.total_fee)

    const order = await prisma.order.findUnique({
      where: { orderNo },
      select: { paymentMethod: true },
    })

    const method = (order?.paymentMethod as 'wechat' | 'alipay') || 'wechat'

    const ok = await billingService.handlePaymentCallback(
      orderNo,
      payjsOrderId,
      method,
      {
        amountInCents: totalFee,
        callbackData: params,
      }
    )

    if (!ok) {
      return new NextResponse('fail', { status: 400 })
    }

    return new NextResponse('success')
  } catch (error) {
    console.error('Payjs payment callback error:', error)
    return new NextResponse('fail', { status: 500 })
  }
}
