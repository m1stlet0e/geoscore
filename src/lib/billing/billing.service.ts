// ============================================
// Billing Service
// 支付逻辑 + 额度管理
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

    // 模拟支付 URL（实际需要对接微信/支付宝 API）
    const paymentUrl = this.generatePaymentUrl(orderNo, config.price, paymentMethod)

    return {
      orderNo,
      amount: config.price,
      paymentUrl,
    }
  }

  // ============================================
  // 2. 生成支付 URL（模拟）
  // ============================================

  private generatePaymentUrl(
    orderNo: string,
    amount: number,
    method: 'wechat' | 'alipay'
  ): string {
    // 实际生产环境需要对接微信支付/支付宝 API
    // 这里返回模拟 URL
    if (method === 'wechat') {
      return `weixin://wxpay/bizpayurl?pr=${orderNo}`
    } else {
      return `alipays://platformapi/startapp?appId=20000067&url=${encodeURIComponent(
        `https://geoscore.ai/pay/${orderNo}`
      )}`
    }
  }

  // ============================================
  // 3. 处理支付回调
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
  // 4. 激活订阅
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
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 1) // 1 个月

    await prisma.subscription.create({
      data: {
        userId,
        plan,
        status: 'ACTIVE',
        startDate,
        endDate,
        autoRenew: true,
      },
    })

    // 更新用户计划
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        planExpiresAt: endDate,
      },
    })
  }

  // ============================================
  // 5. 分配额度
  // ============================================

  private async allocateQuotas(userId: string, plan: Plan): Promise<void> {
    const config = PLAN_CONFIG[plan]
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    for (const [type, total] of Object.entries(config.quotas)) {
      await prisma.quota.upsert({
        where: {
          userId_type_period_periodStart: {
            userId,
            type: type as QuotaType,
            period: 'monthly',
            periodStart,
          },
        },
        update: {
          total,
          remaining: total,
          used: 0,
          periodEnd,
        },
        create: {
          userId,
          type: type as QuotaType,
          total,
          used: 0,
          remaining: total,
          period: 'monthly',
          periodStart,
          periodEnd,
        },
      })
    }
  }

  // ============================================
  // 6. 检查额度
  // ============================================

  async checkQuota(
    userId: string,
    type: QuotaType,
    amount: number = 1
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const quota = await prisma.quota.findUnique({
      where: {
        userId_type_period_periodStart: {
          userId,
          type,
          period: 'monthly',
          periodStart,
        },
      },
    })

    if (!quota) {
      // 没有额度记录，分配免费额度
      await this.allocateQuotas(userId, 'FREE')
      return this.checkQuota(userId, type, amount)
    }

    return {
      allowed: quota.remaining >= amount,
      remaining: quota.remaining,
    }
  }

  // ============================================
  // 7. 消费额度
  // ============================================

  async consumeQuota(
    userId: string,
    type: QuotaType,
    amount: number = 1,
    description?: string,
    meta?: Record<string, any>
  ): Promise<boolean> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const quota = await prisma.quota.findUnique({
      where: {
        userId_type_period_periodStart: {
          userId,
          type,
          period: 'monthly',
          periodStart,
        },
      },
    })

    if (!quota || quota.remaining < amount) {
      return false
    }

    // 更新额度
    await prisma.quota.update({
      where: { id: quota.id },
      data: {
        used: { increment: amount },
        remaining: { decrement: amount },
      },
    })

    // 记录用量
    await prisma.quotaUsage.create({
      data: {
        quotaId: quota.id,
        amount,
        description,
        meta,
      },
    })

    return true
  }

  // ============================================
  // 8. 获取用户订阅
  // ============================================

  async getSubscription(userId: string): Promise<any | null> {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ============================================
  // 9. 获取订单列表
  // ============================================

  async getOrders(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    orders: any[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const total = await prisma.order.count({
      where: { userId },
    })

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

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
  // 10. 获取用户额度
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
      include: {
        usages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
  }

  // ============================================
  // 11. 取消订阅
  // ============================================

  async cancelSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId)
    if (!subscription) return false

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        autoRenew: false,
      },
    })

    return true
  }

  // ============================================
  // 12. 获取套餐对比
  // ============================================

  getPlanComparison(): typeof PLAN_CONFIG {
    return PLAN_CONFIG
  }
}

// 导出单例
export const billingService = new BillingService()
