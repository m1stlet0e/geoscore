// ============================================
// 手机号登录/注册 API
// POST /api/auth/phone-login
// 开发环境：888888 万能验证码，或 DB 中存储的调试验证码
// 生产环境：调用 Dypns checkSmsVerifyCode 核验
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { encodeSessionToken, SESSION_COOKIE_NAME } from '@/auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { verifySmsCode } from '@/lib/sms'
import { verificationService } from '@/lib/services/verification.service'
import { findOrCreatePhoneUser } from '@/lib/services/auth.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码必须是 6 位'),
  name: z.string().optional(),
  purpose: z.enum(['register', 'login']).optional().default('login'),
})

const IS_DEV = process.env.NODE_ENV === 'development'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const rl = rateLimit(`phone-login:${ip}`, { maxRequests: 5, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: '操作过于频繁，请稍后再试' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
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
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? '参数错误' },
        { status: 400 },
      )
    }

    const { phone, code, name, purpose } = parsed.data

    // ── 验证码核验 ──

    if (IS_DEV && code === '888888') {
      // 开发环境万能验证码，直接通过
    } else if (IS_DEV) {
      // 开发环境非万能码：走 DB 核验
      try {
        const isValid = await verificationService.verify(phone, 'sms', purpose, code)
        if (!isValid) {
          return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
        }
      } catch (dbErr) {
        console.error('[phone-login] DB verify error:', dbErr)
        return NextResponse.json({ error: '服务暂时不可用，请稍后重试' }, { status: 500 })
      }
    } else {
      // 生产环境：调用 Dypns 核验（Dypns 自己管理验证码有效期和重试次数）
      const dypnsOk = await verifySmsCode(phone, code)
      if (!dypnsOk) {
        return NextResponse.json({ error: '验证码错误或已过期' }, { status: 400 })
      }
    }

    // ── 查找或创建用户 ──

    const { user, isNewUser } = await findOrCreatePhoneUser(phone, name)

    // 消费验证码（仅开发环境有 DB 记录需要消费；非关键）
    if (IS_DEV) {
      try {
        await verificationService.consume(phone, 'sms', purpose)
      } catch {
        /* 忽略 */
      }
    }

    // ── 生成 JWT ──

    const sessionToken = await encodeSessionToken({
      name: user.name ?? user.phone ?? undefined,
      email: user.email ?? undefined,
      picture: null,
      sub: user.id,
      id: user.id,
      plan: user.plan ?? 'FREE',
    })

    const response = NextResponse.json({ success: true, userId: user.id, isNewUser })

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误'
    console.error('[phone-login] unexpected error:', message)
    return NextResponse.json({ error: '服务器内部错误，请稍后重试' }, { status: 500 })
  }
}
