// ============================================
// Payjs 支付集成
// 文档：https://payjs.cn/docs/
// 个人可用，无需营业执照
// ============================================

import crypto from 'crypto'

interface PayjsConfig {
  mchid: string   // 商户号
  key: string     // 密钥
}

interface NativePayParams {
  total_fee: number     // 金额，单位：分
  out_trade_no: string  // 订单号
  body?: string         // 订单标题
  notify_url?: string   // 回调地址
  attach?: string       // 自定义数据
}

interface CashierPayParams extends NativePayParams {
  return_url?: string   // 支付完成跳转地址
}

interface PayjsResponse {
  return_code: number   // 1:成功，0:失败
  return_msg: string
  payjs_order_id?: string
  out_trade_no?: string
  total_fee?: number
  code_url?: string     // 二维码内容
  qrcode?: string       // 二维码图片地址
  sign?: string
}

export class Payjs {
  private config: PayjsConfig

  constructor(config: PayjsConfig) {
    this.config = config
  }

  // 签名算法
  private sign(params: Record<string, any>): string {
    // 1. 按 key 排序
    const sortedKeys = Object.keys(params).sort()
    
    // 2. 拼接字符串
    const stringA = sortedKeys
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .map(key => `${key}=${params[key]}`)
      .join('&')
    
    // 3. 拼接密钥
    const stringSignTemp = `${stringA}&key=${this.config.key}`
    
    // 4. MD5 加密
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase()
  }

  // Native 扫码支付（主扫）
  async native(params: NativePayParams): Promise<PayjsResponse> {
    const requestData = {
      mchid: this.config.mchid,
      total_fee: params.total_fee,
      out_trade_no: params.out_trade_no,
      body: params.body || 'GeoScore 订阅',
      notify_url: params.notify_url || '',
      attach: params.attach || '',
    }

    // 添加签名
    const dataWithSign = {
      ...requestData,
      sign: this.sign(requestData)
    }

    // 发送请求（表单格式）
    const formBody = Object.entries(dataWithSign)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    const response = await fetch('https://payjs.cn/api/native', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody
    })

    return response.json()
  }

  // 收银台支付（跳转到 Payjs 页面）
  async cashier(params: CashierPayParams): Promise<PayjsResponse> {
    const requestData = {
      mchid: this.config.mchid,
      total_fee: params.total_fee,
      out_trade_no: params.out_trade_no,
      body: params.body || 'GeoScore 订阅',
      notify_url: params.notify_url || '',
      return_url: params.return_url || '',
      attach: params.attach || '',
    }

    // 添加签名
    const dataWithSign = {
      ...requestData,
      sign: this.sign(requestData)
    }

    const formBody = Object.entries(dataWithSign)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    const response = await fetch('https://payjs.cn/api/cashier', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody
    })

    return response.json()
  }

  // 订单查询
  async query(payjsOrderId: string): Promise<any> {
    const requestData = {
      mchid: this.config.mchid,
      payjs_order_id: payjsOrderId,
    }

    const dataWithSign = {
      ...requestData,
      sign: this.sign(requestData)
    }

    const formBody = Object.entries(dataWithSign)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    const response = await fetch('https://payjs.cn/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody
    })

    return response.json()
  }

  // 验证回调签名
  verifyCallback(params: Record<string, any>): boolean {
    const { sign, ...otherParams } = params
    const calculatedSign = this.sign(otherParams)
    return calculatedSign === sign
  }

  // 关闭订单
  async close(payjsOrderId: string): Promise<any> {
    const requestData = {
      mchid: this.config.mchid,
      payjs_order_id: payjsOrderId,
    }

    const dataWithSign = {
      ...requestData,
      sign: this.sign(requestData)
    }

    const formBody = Object.entries(dataWithSign)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')

    const response = await fetch('https://payjs.cn/api/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody
    })

    return response.json()
  }
}
