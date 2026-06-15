// ============================================
// Payjs 支付回调
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { paymentService } from '@/lib/payment'
import { billingService } from '@/lib/billing/billing.service'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, any> = {}
    
    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    console.log('Payjs callback received:', params)

    // 验签
    const isValid = paymentService.verifyCallback(params)
    
    if (!isValid) {
      console.error('Payjs callback signature verification failed')
      return new NextResponse('签名验证失败', { status: 400 })
    }

    // 处理支付结果
    if (params.status === '1') {
      // 支付成功
      const orderNo = params.out_trade_no
      const payjsOrderId = params.payjs_order_id

      console.log(`Payjs payment success: orderNo=${orderNo}, payjsOrderId=${payjsOrderId}`)

      // 从订单记录中读取实际支付方式，而非硬编码
      const order = await prisma.order.findUnique({
        where: { orderNo },
        select: { paymentMethod: true },
      })

      const method = (order?.paymentMethod as 'wechat' | 'alipay') || 'wechat'

      await billingService.handlePaymentCallback(orderNo, payjsOrderId, method)
    }

    // 返回 success（Payjs 要求返回 "success"）
    return new NextResponse('success')
  } catch (error) {
    console.error('Payjs payment callback error:', error)
    return new NextResponse('fail', { status: 500 })
  }
}
