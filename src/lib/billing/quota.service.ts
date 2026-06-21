import { Prisma, QuotaType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  tryConsumeQuota,
  checkQuota,
  QuotaExceededError,
  QuotaNotFoundError,
} from '@/lib/services/quota.service'

export { QuotaExceededError, QuotaNotFoundError }

export type QuotaDenyReason = 'INSUFFICIENT_QUOTA' | 'PLAN_EXPIRED' | 'QUOTA_NOT_FOUND'

/**
 * 商业化配额门面：适配多类型 Quota 表 + 会员过期校验 + 幂等扣减
 */
export class QuotaService {
  async checkAndDeductScanCount(
    userId: string,
    cost = 1,
    idempotencyKey?: string,
    meta?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      if (idempotencyKey) {
        const existing = await prisma.quotaUsage.findFirst({
          where: {
            description: idempotencyKey,
            quota: { userId, type: 'SCAN' },
          },
        })
        if (existing) return true
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, planExpiresAt: true },
      })

      if (
        user &&
        user.plan !== 'FREE' &&
        user.planExpiresAt &&
        user.planExpiresAt < new Date()
      ) {
        return false
      }

      const { allowed } = await checkQuota(userId, 'SCAN')
      if (!allowed) return false

      await tryConsumeQuota(
        userId,
        'SCAN',
        cost,
        idempotencyKey ?? 'scan_deduct',
        meta as Prisma.InputJsonValue | undefined
      )
      return true
    } catch (error) {
      if (
        error instanceof QuotaExceededError ||
        error instanceof QuotaNotFoundError
      ) {
        return false
      }
      console.error('Failed to deduct SCAN quota:', error)
      throw error
    }
  }

  async checkAndDeduct(
    userId: string,
    type: QuotaType,
    cost = 1,
    idempotencyKey?: string,
    meta?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      if (idempotencyKey) {
        const existing = await prisma.quotaUsage.findFirst({
          where: {
            description: idempotencyKey,
            quota: { userId, type },
          },
        })
        if (existing) return true
      }

      const { allowed } = await checkQuota(userId, type)
      if (!allowed) return false

      await tryConsumeQuota(
        userId,
        type,
        cost,
        idempotencyKey ?? `${type}_deduct`,
        meta as Prisma.InputJsonValue | undefined
      )
      return true
    } catch (error) {
      if (
        error instanceof QuotaExceededError ||
        error instanceof QuotaNotFoundError
      ) {
        return false
      }
      throw error
    }
  }

  async getScanRemaining(userId: string): Promise<number> {
    const { remaining } = await checkQuota(userId, 'SCAN')
    return remaining
  }
}

export const quotaService = new QuotaService()
