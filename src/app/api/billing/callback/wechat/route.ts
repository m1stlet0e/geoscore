import { NextRequest, NextResponse } from 'next/server'
import { billingService } from '@/lib/billing/billing.service'
import { getWechatPayClient, getWechatPlatformCert } from '@/lib/payment/providers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const timestamp = request.headers.get('wechatpay-timestamp') ?? ''
    const nonce = request.headers.get('wechatpay-nonce') ?? ''
    const signature = request.headers.get('wechatpay-signature') ?? ''

    const wechatPay = getWechatPayClient()
    const platformCert = getWechatPlatformCert()

    if (!wechatPay || !platformCert) {
      console.error('WeChat Pay not configured for callback verification')
      return NextResponse.json({ code: 'FAIL', message: 'not configured' }, { status: 500 })
    }

    if (!timestamp || !nonce || !signature) {
      return NextResponse.json({ code: 'FAIL', message: 'missing headers' }, { status: 400 })
    }

    const valid = wechatPay.verifySignature(timestamp, nonce, body, signature, platformCert)
    if (!valid) {
      console.error('WeChat Pay callback signature invalid')
      return NextResponse.json({ code: 'FAIL', message: 'invalid signature' }, { status: 401 })
    }

    const notification = JSON.parse(body) as {
      event_type?: string
      resource?: {
        ciphertext: string
        nonce: string
        associated_data?: string
      }
    }

    if (notification.event_type !== 'TRANSACTION.SUCCESS' || !notification.resource) {
      return NextResponse.json({ code: 'SUCCESS', message: 'ignored' })
    }

    const decrypted = wechatPay.decryptNotification(
      notification.resource.ciphertext,
      notification.resource.nonce,
      notification.resource.associated_data ?? 'transaction'
    ) as {
      out_trade_no?: string
      transaction_id?: string
      trade_state?: string
      amount?: { total?: number }
    }

    const tradeState = decrypted.trade_state
    if (tradeState && tradeState !== 'SUCCESS') {
      return NextResponse.json({ code: 'SUCCESS', message: 'ignored non-success' })
    }

    const orderNo = decrypted.out_trade_no
    const transactionId = decrypted.transaction_id
    const total = decrypted.amount?.total

    if (!orderNo || !transactionId) {
      return NextResponse.json({ code: 'FAIL', message: 'invalid payload' }, { status: 400 })
    }

    const ok = await billingService.handlePaymentCallback(
      orderNo,
      transactionId,
      'wechat',
      {
        amountInCents: total,
        callbackData: decrypted as Record<string, unknown>,
      }
    )

    if (!ok) {
      return NextResponse.json({ code: 'FAIL', message: 'processing failed' }, { status: 500 })
    }

    return NextResponse.json({ code: 'SUCCESS', message: 'OK' })
  } catch (error) {
    console.error('WeChat callback error:', error)
    return NextResponse.json({ code: 'FAIL', message: 'Internal error' }, { status: 500 })
  }
}
