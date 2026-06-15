// ============================================
// 手机号登录/注册 API
// POST /api/auth/phone-login
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'
import { verifyCode } from '@/lib/sms'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码必须是 6 位'),
  name: z.string().optional(),
})

// 与 NextAuth JWT 策略保持一致的 session token 生成
async function createSessionToken(user: {
  id: string
  email: string | null
  name: string | null
  phone: string | null
}): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
  )
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    name: user.name ?? user.phone ?? undefined,
    email: user.email ?? user.phone ?? undefined,
    picture: null,
    id: user.id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + 30 * 24 * 60 * 60) // 30 天
    .setJti(crypto.randomUUID())
    .sign(secret)
}

export async function POST(req: Request) {
  // IP 级别 rate limiting：每 IP 每分钟最多 5 次登录尝试
  const ip = getClientIp(req)
  const rl = rateLimit(`phone-login:${ip}`, { maxRequests: 5, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '操作过于频繁，请稍后再试' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
      }
    )
  }

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

    const isNewUser = !user

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

    // 创建 JWT session token（与 NextAuth 格式兼容）
    const sessionToken = await createSessionToken(user)

    // 构建响应，设置 session cookie
    const response = NextResponse.json({
      success: true,
      userId: user.id,
      isNewUser,
    })

    // 设置与 NextAuth 一致的 cookie
    const cookieName = process.env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token'

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 天
    })

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
