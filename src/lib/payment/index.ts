// ============================================
// 统一支付服务（Payjs 版本）
// 个人可用，无需营业执照
// ============================================

import { Payjs } from './payjs'

interface PaymentConfig {
  payjs?: {
    mchid: string
    key: string
  }
}

export type PaymentMethod = 'wechat' | 'alipay'

export interface CreatePaymentParams {
  orderNo: string
  amount: number // 分
  description: string
  method: PaymentMethod
}

export interface PaymentResult {
  // Payjs Native 支付
  codeUrl?: string      // 二维码内容
  qrcode?: string       // 二维码图片地址
  payjsOrderId?: string // Payjs 订单号
  // 收银台跳转
  cashierUrl?: string
}

class PaymentService {
  private payjs: Payjs | null = null
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://geoscore.ai'
  }

  // 初始化支付客户端
  init(config: PaymentConfig) {
    if (config.payjs) {
      this.payjs = new Payjs(config.payjs)
    }
  }

  // 创建支付
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const { orderNo, amount, description } = params

    if (!this.payjs) {
      throw new Error('Payjs not configured. Please set PAYJS_MCHID and PAYJS_KEY in .env')
    }

    const notifyUrl = `${this.baseUrl}/api/billing/payjs/notify`
    const returnUrl = `${this.baseUrl}/dashboard/settings/billing`

    // 使用收银台模式（支持微信/支付宝选择页面）
    const result = await this.payjs.cashier({
      total_fee: amount,
      out_trade_no: orderNo,
      body: description,
      notify_url: notifyUrl,
      return_url: returnUrl,
    })

    if (result.return_code !== 1) {
      throw new Error(`Payjs error: ${result.return_msg}`)
    }

    return {
      codeUrl: result.code_url,
      qrcode: result.qrcode,
      payjsOrderId: result.payjs_order_id,
      // 收银台模式返回跳转 URL
      cashierUrl: `https://payjs.cn/cashier/${result.payjs_order_id}`
    }
  }

  // 验证回调签名
  verifyCallback(params: Record<string, any>): boolean {
    if (!this.payjs) return false
    return this.payjs.verifyCallback(params)
  }

  // 查询订单
  async queryOrder(payjsOrderId: string): Promise<any> {
    if (!this.payjs) {
      throw new Error('Payjs not configured')
    }
    return this.payjs.query(payjsOrderId)
  }

  // 关闭订单
  async closeOrder(payjsOrderId: string): Promise<any> {
    if (!this.payjs) {
      throw new Error('Payjs not configured')
    }
    return this.payjs.close(payjsOrderId)
  }
}

// 单例
export const paymentService = new PaymentService()

// 初始化（从环境变量读取配置）
if (process.env.PAYJS_MCHID && process.env.PAYJS_KEY) {
  paymentService.init({
    payjs: {
      mchid: process.env.PAYJS_MCHID,
      key: process.env.PAYJS_KEY
    }
  })
}
