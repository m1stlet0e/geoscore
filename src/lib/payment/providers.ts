import { Alipay } from '@/lib/payment/alipay'
import { WechatPay } from '@/lib/payment/wechat-pay'

export function getWechatPayClient(): WechatPay | null {
  const appId = process.env.WECHAT_PAY_APP_ID
  const mchId = process.env.WECHAT_PAY_MCH_ID
  const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO
  const privateKey = process.env.WECHAT_PAY_PRIVATE_KEY

  if (!appId || !mchId || !apiV3Key || !serialNo || !privateKey) {
    return null
  }

  return new WechatPay({
    appId,
    mchId,
    apiV3Key,
    serialNo,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  })
}

export function getWechatPlatformCert(): string | null {
  const cert = process.env.WECHAT_PLATFORM_CERT
  if (!cert) return null
  return cert.replace(/\\n/g, '\n')
}

export function getAlipayClient(): Alipay | null {
  const appId = process.env.ALIPAY_APP_ID
  const privateKey = process.env.ALIPAY_PRIVATE_KEY
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY

  if (!appId || !privateKey || !alipayPublicKey) {
    return null
  }

  return new Alipay({
    appId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    alipayPublicKey: alipayPublicKey.replace(/\\n/g, '\n'),
    gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
  })
}
