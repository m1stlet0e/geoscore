import { Prisma, QuotaType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export class QuotaExceededError extends Error {
  constructor(type: QuotaType, remaining: number) {
    super(`Quota exceeded for ${type}, remaining: ${remaining}`)
    this.name = 'QuotaExceededError'
  }
}

export class QuotaNotFoundError extends Error {
  constructor(type: QuotaType) {
    super(`No quota record for type ${type}`)
    this.name = 'QuotaNotFoundError'
  }
}

function currentPeriodStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export async function checkQuota(
  userId: string,
  type: QuotaType
): Promise<{ allowed: boolean; remaining: number }> {
  const periodStart = currentPeriodStart()

  const quota = await prisma.quota.findFirst({
    where: { userId, type, period: 'monthly', periodStart },
  })

  if (!quota) return { allowed: false, remaining: 0 }
  const remaining = quota.total - quota.used
  return { allowed: remaining > 0, remaining }
}

/**
 * 原子扣减配额（并发安全）：条件更新 + 用量审计
 */
export async function tryConsumeQuota(
  userId: string,
  type: QuotaType,
  amount = 1,
  description?: string,
  meta?: Prisma.InputJsonValue
): Promise<{ remaining: number }> {
  if (amount <= 0) {
    throw new Error('consume amount must be positive')
  }

  const periodStart = currentPeriodStart()

  return prisma.$transaction(async (tx) => {
    const quota = await tx.quota.findFirst({
      where: { userId, type, period: 'monthly', periodStart },
    })

    if (!quota) {
      throw new QuotaNotFoundError(type)
    }

    const updated = await tx.quota.updateMany({
      where: {
        id: quota.id,
        used: { lte: quota.total - amount },
      },
      data: {
        used: { increment: amount },
        remaining: { decrement: amount },
      },
    })

    if (updated.count === 0) {
      const remaining = Math.max(0, quota.total - quota.used)
      throw new QuotaExceededError(type, remaining)
    }

    await tx.quotaUsage.create({
      data: {
        quotaId: quota.id,
        amount,
        description,
        meta: meta ?? undefined,
      },
    })

    const fresh = await tx.quota.findUnique({ where: { id: quota.id } })
    return { remaining: fresh ? fresh.total - fresh.used : 0 }
  })
}

export const quotaService = {
  checkQuota,
  tryConsumeQuota,
}
