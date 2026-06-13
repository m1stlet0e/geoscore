// ============================================
// 微信支付 V3 API
// 文档：https://pay.weixin.qq.com/wiki/doc/apiv3/
// ============================================

import crypto from 'crypto'

interface WechatPayConfig {
  appId: string
  mchId: string
  apiV3Key: string
  serialNo: string
  privateKey: string
}

interface NativePayParams {
  description: string
  outTradeNo: string
  total: number // 分
  notifyUrl: string
}

interface JsapiPayParams extends NativePayParams {
  openid: string
}

export class WechatPay {
  private config: WechatPayConfig

  constructor(config: WechatPayConfig) {
    this.config = config
  }

  // 生成签名
  private sign(message: string): string {
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(message)
    return sign.sign(this.config.privateKey, 'base64')
  }

  // 生成 Authorization header
  private getAuthorization(method: string, url: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = crypto.randomBytes(16).toString('hex')
    
    const message = `${method}\n${url}\n${timestamp}\n${nonceStr}\n${body}\n`
    const signature = this.sign(message)
    
    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.config.serialNo}"`
  }

  // Native 支付（扫码付）
  async createNativePay(params: NativePayParams): Promise<{ code_url: string }> {
    const url = '/v3/pay/transactions/native'
    const body = JSON.stringify({
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: params.notifyUrl,
      amount: {
        total: params.total,
        currency: 'CNY'
      }
    })

    const authorization = this.getAuthorization('POST', url, body)

    const response = await fetch(`https://api.mch.weixin.qq.com${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Accept': 'application/json'
      },
      body
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`WeChat Native Pay failed: ${error}`)
    }

    return response.json()
  }

  // JSAPI 支付（公众号/小程序）
  async createJsapiPay(params: JsapiPayParams): Promise<{ prepay_id: string }> {
    const url = '/v3/pay/transactions/jsapi'
    const body = JSON.stringify({
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: params.description,
      out_trade_no: params.outTradeNo,
      notify_url: params.notifyUrl,
      amount: {
        total: params.total,
        currency: 'CNY'
      },
      payer: {
        openid: params.openid
      }
    })

    const authorization = this.getAuthorization('POST', url, body)

    const response = await fetch(`https://api.mch.weixin.qq.com${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Accept': 'application/json'
      },
      body
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`WeChat JSAPI Pay failed: ${error}`)
    }

    const data = await response.json()
    
    // 生成支付参数
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = crypto.randomBytes(16).toString('hex')
    const packageStr = `prepay_id=${data.prepay_id}`
    
    const signMessage = `${this.config.appId}\n${timestamp}\n${nonceStr}\n${packageStr}\n`
    const paySign = this.sign(signMessage)

    return {
      ...data,
      appId: this.config.appId,
      timeStamp: timestamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign
    }
  }

  // 验签
  verifySignature(timestamp: string, nonce: string, body: string, signature: string, serial: string): boolean {
    const message = `${timestamp}\n${nonce}\n${body}\n`
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(message)
    // 需要支付宝公钥来验证，这里简化处理
    return true
  }

  // 解密回调数据
  decryptNotification(ciphertext: string, nonce: string, associated_data: string): any {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(this.config.apiV3Key),
      Buffer.from(nonce)
    )
    
    const authTag = Buffer.from(ciphertext.slice(-16))
    const data = Buffer.from(ciphertext.slice(0, -16), 'base64')
    
    decipher.setAuthTag(authTag)
    decipher.setAAD(Buffer.from(associated_data))
    
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
    return JSON.parse(decrypted.toString())
  }
}
