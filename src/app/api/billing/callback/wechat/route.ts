import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/billing/billing.service'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement WeChat Pay signature verification
    // https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_1_5.shtml
    const body = await request.json()

    const { orderNo, transactionId } = body

    if (!orderNo || !transactionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await billingService.handlePaymentCallback(orderNo, transactionId, 'wechat')

    if (!result) {
      return NextResponse.json({ error: 'Callback processing failed' }, { status: 500 })
    }

    // Return WeChat success response format
    return NextResponse.json({ code: 'SUCCESS', message: 'OK' })
  } catch (error) {
    console.error('WeChat callback error:', error)
    return NextResponse.json({ code: 'FAIL', message: 'Internal error' }, { status: 500 })
  }
}
