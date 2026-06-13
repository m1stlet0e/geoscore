// ============================================
// 支付宝开放平台 API
// 文档：https://opendocs.alipay.com/
// ============================================

import crypto from 'crypto'

interface AlipayConfig {
  appId: string
  privateKey: string
  alipayPublicKey: string
  gateway: string
}

interface PagePayParams {
  outTradeNo: string
  totalAmount: string // 元
  subject: string
  notifyUrl: string
  returnUrl?: string
}

interface WapPayParams extends PagePayParams {
  quitUrl?: string
}

export class Alipay {
  private config: AlipayConfig

  constructor(config: AlipayConfig) {
    this.config = config
  }

  // 签名
  private sign(content: string): string {
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(content)
    return sign.sign(this.config.privateKey, 'base64')
  }

  // 验签
  verify(content: string, signature: string): boolean {
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(content)
    return verify.verify(this.config.alipayPublicKey, signature, 'base64')
  }

  // 通用请求参数
  private buildParams(method: string, bizContent: Record<string, any>): Record<string, string> {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    
    const params: Record<string, string> = {
      app_id: this.config.appId,
      method,
      format: 'JSON',
      return_url: 'https://geoscore.ai/api/billing/alipay/return',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp,
      version: '1.0',
      notify_url: 'https://geoscore.ai/api/billing/alipay/notify',
      biz_content: JSON.stringify(bizContent)
    }

    // 排序并签名
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')

    params.sign = this.sign(sortedParams)

    return params
  }

  // 电脑网站支付
  createPagePay(params: PagePayParams): string {
    const bizContent = {
      out_trade_no: params.outTradeNo,
      total_amount: params.totalAmount,
      subject: params.subject,
      product_code: 'FAST_INSTANT_TRADE_PAY'
    }

    const queryParams = this.buildParams('alipay.trade.page.pay', bizContent)
    
    // 返回支付表单 URL
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    return `${this.config.gateway}?${queryString}`
  }

  // 手机网站支付
  createWapPay(params: WapPayParams): string {
    const bizContent = {
      out_trade_no: params.outTradeNo,
      total_amount: params.totalAmount,
      subject: params.subject,
      product_code: 'QUICK_WAP_WAY',
      quit_url: params.quitUrl || 'https://geoscore.ai/pricing'
    }

    const queryParams = this.buildParams('alipay.trade.wap.pay', bizContent)
    
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    return `${this.config.gateway}?${queryString}`
  }

  // 查询订单
  async queryOrder(outTradeNo: string): Promise<any> {
    const bizContent = {
      out_trade_no: outTradeNo
    }

    const params = this.buildParams('alipay.trade.query', bizContent)
    
    const formBody = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    const response = await fetch(this.config.gateway, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    })

    return response.json()
  }

  // 验证回调签名
  verifyCallback(params: Record<string, string>): boolean {
    const sign = params.sign
    const signType = params.sign_type
    
    // 移除 sign 和 sign_type
    const filteredParams = { ...params }
    delete filteredParams.sign
    delete filteredParams.sign_type

    // 排序
    const sortedParams = Object.keys(filteredParams)
      .sort()
      .filter(key => filteredParams[key] !== '' && filteredParams[key] !== undefined)
      .map(key => `${key}=${filteredParams[key]}`)
      .join('&')

    return this.verify(sortedParams, sign)
  }
}
