// ============================================
// Billing Service
// 支付逻辑 + 额度管理（Payjs 版本）
// ============================================

import { prisma } from '@/lib/prisma'
import { Plan, SubStatus, OrderStatus, PayStatus, QuotaType } from '@prisma/client'
import crypto from 'crypto'

// ============================================
// 套餐配置
// ============================================

export const PLAN_CONFIG: Record<Plan, {
  name: string
  price: number // CNY/月
  quotas: Record<QuotaType, number>
  features: string[]
}> = {
  FREE: {
    name: '免费版',
    price: 0,
    quotas: {
      SCAN: 5,
      PROMPT: 20,
      CITATION_ANALYSIS: 10,
      GAP_ANALYSIS: 5,
      CONTENT_GENERATE: 3,
      REPORT_GENERATE: 1,
    },
    features: ['基础监控', '5 个品牌', '每周报告'],
  },
  PRO: {
    name: '专业版',
    price: 299,
    quotas: {
      SCAN: 50,
      PROMPT: 200,
      CITATION_ANALYSIS: 100,
      GAP_ANALYSIS: 50,
      CONTENT_GENERATE: 30,
      REPORT_GENERATE: 10,
    },
    features: ['完整监控', '20 个品牌', '每日报告', 'Citation 分析', 'Gap 分析'],
  },
  GROWTH: {
    name: '增长版',
    price: 799,
    quotas: {
      SCAN: 200,
      PROMPT: 1000,
      CITATION_ANALYSIS: 500,
      GAP_ANALYSIS: 200,
      CONTENT_GENERATE: 100,
      REPORT_GENERATE: 50,
    },
    features: ['全部功能', '50 个品牌', '实时报告', '内容生成', '优先支持'],
  },
  ENTERPRISE: {
    name: '企业版',
    price: 2999,
    quotas: {
      SCAN: 999999,
      PROMPT: 999999,
      CITATION_ANALYSIS: 999999,
      GAP_ANALYSIS: 999999,
      CONTENT_GENERATE: 999999,
      REPORT_GENERATE: 999999,
    },
    features: ['无限额度', '无限品牌', '专属客服', 'API 接口', '定制报告'],
  },
}

// ============================================
// Billing Service Class
// ============================================

export class BillingService {
  // ============================================
  // 1. 创建订单
  // ============================================

  async createOrder(
    userId: string,
    plan: Plan,
    paymentMethod: 'wechat' | 'alipay'
  ): Promise<{
    orderNo: string
    amount: number
    paymentUrl: string
    codeUrl?: string
    cashierUrl?: string
  }> {
    const config = PLAN_CONFIG[plan]
    if (!config) throw new Error('Invalid plan')

    // 生成订单号
    const orderNo = `GS${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`

    // 创建订单
    const order = await prisma.order.create({
      data: {
        userId,
        orderNo,
        plan,
        amount: config.price,
        currency: 'CNY',
        status: 'PENDING',
        paymentMethod,
        expiredAt: new Date(Date.now() + 30 * 60 * 1000), // 30 分钟过期
      },
    })

    // 调用 Payjs 支付 API
    const { paymentService } = await import('@/lib/payment')
    
    const paymentResult = await paymentService.createPayment({
      orderNo,
      amount: config.price * 100, // 转为分
      description: `GeoScore ${config.name}`,
      method: paymentMethod
    })

    return {
      orderNo,
      amount: config.price,
      paymentUrl: paymentResult.cashierUrl || paymentResult.codeUrl || '',
      codeUrl: paymentResult.codeUrl,
      cashierUrl: paymentResult.cashierUrl
    }
  }

  // ============================================
  // 2. 处理支付回调
  // ============================================

  async handlePaymentCallback(
    orderNo: string,
    transactionId: string,
    method: 'wechat' | 'alipay'
  ): Promise<boolean> {
    const order = await prisma.order.findUnique({
      where: { orderNo },
    })

    if (!order || order.status !== 'PENDING') {
      return false
    }

    // 更新订单状态
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentId: transactionId,
        paidAt: new Date(),
      },
    })

    // 创建支付记录
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method,
        amount: order.amount,
        currency: order.currency,
        status: 'SUCCESS',
        externalId: transactionId,
        paidAt: new Date(),
      },
    })

    // 激活订阅
    await this.activateSubscription(order.userId, order.plan, order.id)

    // 分配额度
    await this.allocateQuotas(order.userId, order.plan)

    return true
  }

  // ============================================
  // 3. 激活订阅
  // ============================================

  private async activateSubscription(
    userId: string,
    plan: Plan,
    orderId: string
  ): Promise<void> {
    // 取消现有订阅
    await prisma.subscription.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'CANCELLED',
      },
    })

    // 创建新订阅
    const now = new Date()
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())

    await prisma.subscription.create({
      data: {
        userId,
        plan,
        status: 'ACTIVE',
        startDate: now,
        endDate: periodEnd,
      },
    })

    // 关联订单到订阅（通过 subscriptionId 字段）
    const sub = await prisma.subscription.findFirst({
      where: { userId, plan, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    })
    if (sub) {
      await prisma.order.update({
        where: { id: orderId },
        data: { subscriptionId: sub.id },
      })
    }
  }

  // ============================================
  // 4. 分配额度
  // ============================================

  private async allocateQuotas(userId: string, plan: Plan): Promise<void> {
    const config = PLAN_CONFIG[plan]
    if (!config) return

    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // 删除旧额度
    await prisma.quota.deleteMany({
      where: {
        userId,
        period: 'monthly',
        periodStart,
      },
    })

    // 创建新额度
    const quotaEntries = Object.entries(config.quotas).map(([type, total]) => ({
      userId,
      type: type as QuotaType,
      total,
      used: 0,
      remaining: total,
      period: 'monthly' as const,
      periodStart,
      periodEnd,
    }))

    await prisma.quota.createMany({
      data: quotaEntries,
    })
  }

  // ============================================
  // 5. 检查额度
  // ============================================

  async checkQuota(userId: string, type: QuotaType): Promise<{ allowed: boolean; remaining: number }> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const quota = await prisma.quota.findFirst({
      where: {
        userId,
        type,
        period: 'monthly',
        periodStart,
      },
    })

    if (!quota) return { allowed: false, remaining: 0 }
    return { allowed: quota.used < quota.total, remaining: quota.total - quota.used }
  }

  // ============================================
  // 6. 使用额度
  // ============================================

  async useQuota(userId: string, type: QuotaType): Promise<boolean> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const quota = await prisma.quota.findFirst({
      where: {
        userId,
        type,
        period: 'monthly',
        periodStart,
      },
    })

    if (!quota || quota.used >= quota.total) {
      return false
    }

    await prisma.quota.update({
      where: { id: quota.id },
      data: { used: quota.used + 1 },
    })

    return true
  }

  // ============================================
  // 7. 获取用户订阅
  // ============================================

  async getSubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ============================================
  // 8. 获取用户订单
  // ============================================

  async getOrders(userId: string, page = 1, limit = 10) {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          payments: true,
        },
      }),
      prisma.order.count({ where: { userId } }),
    ])

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  // ============================================
  // 9. 获取用户额度
  // ============================================

  async getQuotas(userId: string): Promise<any[]> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    return prisma.quota.findMany({
      where: {
        userId,
        period: 'monthly',
        periodStart,
      },
    })
  }

  // ============================================
  // 10. 取消订阅
  // ============================================

  async cancelSubscription(userId: string): Promise<boolean> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
    })

    if (!subscription) {
      return false
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
      },
    })

    return true
  }

  // ============================================
  // 11. 消费额度
  // ============================================

  async consumeQuota(userId: string, type: QuotaType, amount: number = 1, description?: string, meta?: Record<string, any>): Promise<void> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const quota = await prisma.quota.findFirst({
      where: {
        userId,
        type,
        period: 'monthly',
        periodStart,
      },
    })

    if (!quota) {
      throw new Error(`No quota found for user ${userId}, type ${type}`)
    }

    if (quota.used + amount > quota.total) {
      throw new Error(`Quota exceeded: ${quota.used}/${quota.total}`)
    }

    await prisma.quota.update({
      where: { id: quota.id },
      data: {
        used: quota.used + amount,
        remaining: quota.total - (quota.used + amount),
      },
    })
  }
}

// 单例
export const billingService = new BillingService()
