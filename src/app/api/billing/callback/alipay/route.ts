import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/billing/billing.service'

export async function POST(request: NextRequest) {
  try {
    // TODO: Implement Alipay signature verification
    // https://opendocs.alipay.com/open/270/105902
    const body = await request.json()

    const { orderNo, transactionId } = body

    if (!orderNo || !transactionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await billingService.handlePaymentCallback(orderNo, transactionId, 'alipay')

    if (!result) {
      return NextResponse.json({ error: 'Callback processing failed' }, { status: 500 })
    }

    // Return Alipay success response format
    return new NextResponse('success', { status: 200 })
  } catch (error) {
    console.error('Alipay callback error:', error)
    return new NextResponse('fail', { status: 500 })
  }
}
