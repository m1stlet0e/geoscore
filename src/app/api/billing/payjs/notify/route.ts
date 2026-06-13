// ============================================
// Payjs 支付回调
// ============================================

import { NextRequest, NextResponse } from 'next/server'
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
      const totalFee = params.total_fee

      console.log(`Payjs payment success: orderNo=${orderNo}, payjsOrderId=${payjsOrderId}`)

      await billingService.handlePaymentCallback(orderNo, payjsOrderId, 'wechat')
    }

    // 返回 success（Payjs 要求返回 "success"）
    return new NextResponse('success')
  } catch (error) {
    console.error('Payjs payment callback error:', error)
    return new NextResponse('fail', { status: 500 })
  }
}
