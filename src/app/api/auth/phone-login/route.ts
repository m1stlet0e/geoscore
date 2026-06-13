// ============================================
// 手机号登录/注册 API
// POST /api/auth/phone-login
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyCode } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码必须是 6 位'),
  name: z.string().optional(),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
  }

  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json(
      { error: first?.message ?? '参数错误' },
      { status: 400 }
    )
  }

  const { phone, code, name } = parsed.data

  // 验证验证码
  const isValid = verifyCode(phone, code)
  if (!isValid) {
    return NextResponse.json(
      { error: '验证码错误或已过期' },
      { status: 400 }
    )
  }

  try {
    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, email: true, phone: true, name: true, plan: true }
    })

    if (!user) {
      // 新用户，自动注册
      user = await prisma.user.create({
        data: {
          phone,
          name: name || `用户${phone.slice(-4)}`,
          plan: 'FREE',
        },
        select: { id: true, email: true, phone: true, name: true, plan: true }
      })

      // 创建默认品牌
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
    }

    // 返回成功（实际登录需要通过 NextAuth）
    return NextResponse.json({
      success: true,
      userId: user.id,
      isNewUser: !user.email
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
