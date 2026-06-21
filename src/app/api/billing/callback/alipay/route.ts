import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/billing/billing.service'
import { getAlipayClient } from '@/lib/payment/providers'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const params: Record<string, string> = {}

    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    const alipay = getAlipayClient()
    if (!alipay) {
      console.error('Alipay not configured for callback verification')
      return new NextResponse('fail', { status: 500 })
    }

    if (!alipay.verifyCallback(params)) {
      console.error('Alipay callback signature invalid')
      return new NextResponse('fail', { status: 401 })
    }

    const tradeStatus = params.trade_status
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return new NextResponse('success')
    }

    const orderNo = params.out_trade_no
    const transactionId = params.trade_no
    const totalAmount = Number(params.total_amount)

    if (!orderNo || !transactionId) {
      return new NextResponse('fail', { status: 400 })
    }

    const ok = await billingService.handlePaymentCallback(
      orderNo,
      transactionId,
      'alipay',
      {
        amountInYuan: totalAmount,
        callbackData: params,
      }
    )

    if (!ok) {
      return new NextResponse('fail', { status: 500 })
    }

    return new NextResponse('success')
  } catch (error) {
    console.error('Alipay callback error:', error)
    return new NextResponse('fail', { status: 500 })
  }
}
