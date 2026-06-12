// ============================================
// Admin Service
// 后台管理服务
// ============================================

import { prisma } from '@/lib/prisma'
import { Plan } from '@prisma/client'

type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'

// ============================================
// Types
// ============================================

export interface AdminUser {
  id: string
  email: string
  name: string | null
  plan: Plan
  planExpiresAt: Date | null
  createdAt: Date
  brandCount: number
  totalCitations: number
  totalScans: number
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  totalBrands: number
  totalCitations: number
  totalScans: number
  totalRevenue: number
  planDistribution: Record<Plan, number>
  recentSignups: number
}

export interface SystemConfigItem {
  id: string
  key: string
  value: any
  desc: string | null
  updatedAt: Date
}

// ============================================
// Admin Service Class
// ============================================

export class AdminService {
  // ============================================
  // 1. 获取用户列表
  // ============================================

  async getUsers(
    page: number = 1,
    limit: number = 50,
    search?: string,
    plan?: Plan
  ): Promise<{
    users: AdminUser[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const where: any = {}

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (plan) {
      where.plan = plan
    }

    const total = await prisma.user.count({ where })

    const users = await prisma.user.findMany({
      where,
      include: {
        _count: {
          select: {
            brands: true,
            citations: true,
            scans: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const adminUsers: AdminUser[] = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      planExpiresAt: u.planExpiresAt,
      createdAt: u.createdAt,
      brandCount: u._count.brands,
      totalCitations: u._count.citations,
      totalScans: u._count.scans,
    }))

    return {
      users: adminUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  // ============================================
  // 2. 获取用户详情
  // ============================================

  async getUserDetail(userId: string): Promise<any | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        brands: {
          include: {
            _count: {
              select: {
                citations: true,
                prompts: true,
                scans: true,
              },
            },
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        quotas: true,
        _count: {
          select: {
            brands: true,
            citations: true,
            scans: true,
            contentPieces: true,
          },
        },
      },
    })

    return user
  }

  // ============================================
  // 3. 修改用户套餐
  // ============================================

  async updateUserPlan(
    userId: string,
    plan: Plan,
    adminId: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) return false

    // 更新用户套餐
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        planExpiresAt: plan === 'FREE' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    // 记录操作日志
    await this.logAction(adminId, 'update_user_plan', userId, {
      oldPlan: user.plan,
      newPlan: plan,
    })

    return true
  }

  // ============================================
  // 4. 修改用户角色
  // ============================================

  async updateUserRole(
    userId: string,
    role: string,
    adminId: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) return false

    // NOTE: User model doesn't have 'role' field — store in metadata or skip
    // For now, just log the action
    await this.logAction(adminId, 'update_user_role', userId, {
      requestedRole: role,
    })

    return true
  }

  // ============================================
  // 5. 获取系统统计
  // ============================================

  async getStats(): Promise<AdminStats> {
    const [
      totalUsers,
      totalBrands,
      totalCitations,
      totalScans,
      planCounts,
      recentSignups,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.brand.count(),
      prisma.citation.count(),
      prisma.scanRun.count(),
      prisma.user.groupBy({
        by: ['plan'],
        _count: true,
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ])

    // 活跃用户（最近 30 天有登录）
    const activeUsers = await prisma.session.count({
      where: {
        expires: {
          gte: new Date(),
        },
      },
    })

    // 计算总收入（从已支付订单）
    const revenueResult = await prisma.order.aggregate({
      where: {
        status: 'PAID',
      },
      _sum: {
        amount: true,
      },
    })

    const planDistribution: Record<Plan, number> = {
      FREE: 0,
      PRO: 0,
      GROWTH: 0,
      ENTERPRISE: 0,
    }

    for (const pc of planCounts) {
      planDistribution[pc.plan] = pc._count
    }

    return {
      totalUsers,
      activeUsers,
      totalBrands,
      totalCitations,
      totalScans,
      totalRevenue: Number(revenueResult._sum.amount || 0),
      planDistribution,
      recentSignups,
    }
  }

  // ============================================
  // 6. 获取订单列表
  // ============================================

  async getOrders(
    page: number = 1,
    limit: number = 50,
    status?: string
  ): Promise<{
    orders: any[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const where: any = {}
    if (status) where.status = status

    const total = await prisma.order.count({ where })

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
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
  // 7. 获取系统配置
  // ============================================

  async getConfigs(): Promise<SystemConfigItem[]> {
    return prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    })
  }

  // ============================================
  // 8. 更新系统配置
  // ============================================

  async updateConfig(
    key: string,
    value: any,
    desc: string | null,
    adminId: string
  ): Promise<boolean> {
    await prisma.systemConfig.upsert({
      where: { key },
      update: {
        value,
        desc,
      },
      create: {
        key,
        value,
        desc,
      },
    })

    await this.logAction(adminId, 'update_config', key, {
      value,
    })

    return true
  }

  // ============================================
  // 9. 获取操作日志
  // ============================================

  async getLogs(
    page: number = 1,
    limit: number = 100,
    userId?: string,
    action?: string
  ): Promise<{
    logs: any[]
    pagination: { page: number; limit: number; total: number; pages: number }
  }> {
    const where: any = {}
    if (userId) where.userId = userId
    if (action) where.action = action

    const total = await prisma.adminLog.count({ where })

    const logs = await prisma.adminLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  // ============================================
  // 10. 记录操作日志
  // ============================================

  async logAction(
    userId: string,
    action: string,
    target?: string,
    meta?: Record<string, any>
  ): Promise<void> {
    await prisma.adminLog.create({
      data: {
        userId,
        action,
        target,
        meta,
      },
    })
  }

  // ============================================
  // 11. 获取额度监控
  // ============================================

  async getQuotaOverview(): Promise<any[]> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const quotas = await prisma.quota.findMany({
      where: {
        period: 'monthly',
        periodStart,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, plan: true },
        },
      },
      orderBy: { used: 'desc' },
      take: 100,
    })

    return quotas
  }

  // ============================================
  // 12. 禁用/启用用户
  // ============================================

  async toggleUserStatus(
    userId: string,
    adminId: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) return false

    // 通过删除所有 session 来禁用用户
    const activeSessions = await prisma.session.count({
      where: { userId },
    })

    if (activeSessions > 0) {
      await prisma.session.deleteMany({
        where: { userId },
      })

      await this.logAction(adminId, 'disable_user', userId, {
        sessionsDeleted: activeSessions,
      })
    } else {
      await this.logAction(adminId, 'enable_user', userId, {})
    }

    return true
  }
}

// 导出单例
export const adminService = new AdminService()
