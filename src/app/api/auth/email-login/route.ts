// ============================================
// 邮箱登录 API — 直接用 JWT 设置 cookie
// POST /api/auth/email-login
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { encodeSessionToken, SESSION_COOKIE_NAME } from '@/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const rl = rateLimit(`email-login:${ip}`, { maxRequests: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
      )
    }

    let json: unknown
    try { json = await req.json() } catch {
      return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 })
    }

    const parsed = Body.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '参数错误' }, { status: 400 })
    }

    const email = parsed.data.email.toLowerCase().trim()
    const password = parsed.data.password

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, passwordHash: true, image: true, plan: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
    }

    const sessionToken = await encodeSessionToken({
      name: user.name ?? undefined,
      email: user.email,
      picture: user.image ?? null,
      sub: user.id,
      id: user.id,
      plan: user.plan ?? 'FREE',
    })

    const response = NextResponse.json({ success: true, userId: user.id, email: user.email })

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return response
  } catch (err) {
    console.error('[email-login] error:', err)
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 })
  }
}
