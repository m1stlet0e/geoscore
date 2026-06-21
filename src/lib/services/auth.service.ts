import { prisma } from '@/lib/prisma'
import { billingService } from '@/lib/billing/billing.service'

export async function findOrCreatePhoneUser(phone: string, name?: string) {
  let user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, email: true, phone: true, name: true, plan: true },
  })

  const isNewUser = !user

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        phoneVerified: true,
        name: name || `用户${phone.slice(-4)}`,
        plan: 'FREE',
      },
      select: { id: true, email: true, phone: true, name: true, plan: true },
    })

    await billingService.initializeUserQuotas(user.id, 'FREE')

    try {
      await prisma.brand.create({
        data: {
          userId: user.id,
          name: `${user.name} 的主品牌`,
          status: 'active',
        },
      })
    } catch {
      // 品牌创建失败不影响登录
    }
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true },
    })
  }

  return { user, isNewUser }
}
