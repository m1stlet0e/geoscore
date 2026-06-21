// GET /api/auth/number-auth/callback
// 阿里云 H5 一键登录回调：拿 accessToken → GetMobile → 登录/注册

import { NextResponse } from 'next/server'
import { getMobileFromToken } from '@/lib/number-auth'
import { encodeSessionToken, SESSION_COOKIE_NAME } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const accessToken = searchParams.get('accessToken')
  const result = searchParams.get('result') // 'success' | 'fail'

  if (result !== 'success' || !accessToken) {
    // 用户取消或认证失败 → 回到登录页
    return NextResponse.redirect(new URL('/login?error=number_auth_cancelled', req.url))
  }

  try {
    const phone = await getMobileFromToken(accessToken)
    if (!phone) {
      return NextResponse.redirect(new URL('/login?error=number_auth_failed', req.url))
    }

    // 查找或创建用户
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
          name: `用户${phone.slice(-4)}`,
          plan: 'FREE',
        },
        select: { id: true, email: true, phone: true, name: true, plan: true },
      })

      // 初始化配额
      try {
        const now = new Date()
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const types: Array<{ type: 'SCAN' | 'PROMPT' | 'CITATION_ANALYSIS' | 'GAP_ANALYSIS' | 'CONTENT_GENERATE' | 'REPORT_GENERATE'; total: number }> = [
          { type: 'SCAN', total: 5 }, { type: 'PROMPT', total: 20 },
          { type: 'CITATION_ANALYSIS', total: 10 }, { type: 'GAP_ANALYSIS', total: 5 },
          { type: 'CONTENT_GENERATE', total: 3 }, { type: 'REPORT_GENERATE', total: 1 },
        ]
        for (const t of types) {
          await prisma.quota.create({
            data: { userId: user.id, type: t.type, total: t.total, used: 0, remaining: t.total, period: 'monthly', periodStart, periodEnd },
          })
        }
      } catch { /* 非关键 */ }

      // 创建默认品牌
      try {
        await prisma.brand.create({
          data: { userId: user.id, name: `${user.name} 的主品牌`, status: 'active' },
        })
      } catch { /* 非关键 */ }
    }

    // 生成 JWT
    const sessionToken = await encodeSessionToken({
      name: user.name ?? user.phone ?? undefined,
      email: user.email ?? undefined,
      picture: null,
      sub: user.id,
      id: user.id,
      plan: user.plan ?? 'FREE',
    })

    const response = NextResponse.redirect(
      new URL(isNewUser ? '/onboarding' : '/dashboard', req.url)
    )

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return response
  } catch (err) {
    console.error('[number-auth callback]', err)
    return NextResponse.redirect(new URL('/login?error=number_auth_error', req.url))
  }
}
