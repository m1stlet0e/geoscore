// ============================================
// 发送短信验证码 API
// POST /api/auth/send-code
// 开发环境：本地生成验证码 → 存入 DB → 返回调试验证码
// 生产环境：调用 Dypns 短信认证 → Dypns 负责生成/发送/核验全生命周期
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendSmsCode, generateCode } from '@/lib/sms'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { verificationService } from '@/lib/services/verification.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  purpose: z.enum(['register', 'login', 'reset_password']).optional().default('login'),
})

const IS_DEV = process.env.NODE_ENV === 'development'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const rl = rateLimit(`send-code:${ip}`, { maxRequests: 3, windowMs: 60_000 })
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

    const { phone, purpose } = parsed.data

    // 发送频率检查（仅开发环境依赖 DB）
    if (IS_DEV) {
      try {
        const canSend = await verificationService.canSend(phone, 'sms', purpose)
        if (!canSend) {
          return NextResponse.json(
            { error: '请稍后再试，1 分钟内只能发送 1 次' },
            { status: 429 },
          )
        }
      } catch (dbErr) {
        console.error('[send-code] canSend error:', dbErr)
        // 开发环境 DB 失败不阻塞
      }
    }

    // 生产环境：调用 Dypns 短信认证（Dypns 自己管理频率/有效期/防盗刷）
    const result = await sendSmsCode(phone)

    if (!result.success) {
      return NextResponse.json({ error: '短信发送失败，请稍后重试' }, { status: 500 })
    }

    // 开发环境：本地生成验证码 + 保存到 DB（方便调试，也供 phone-login 用万能码外的场景）
    if (IS_DEV) {
      const code = generateCode()
      try {
        await verificationService.saveCode(phone, 'sms', purpose, code)
      } catch (dbErr) {
        console.error('[send-code] saveCode error:', dbErr)
        // 不阻塞
      }
      return NextResponse.json({
        success: true,
        message: '验证码已发送',
        devCode: code,
      })
    }

    // 生产环境：只返回成功，不暴露验证码
    return NextResponse.json({ success: true, message: '验证码已发送' })
  } catch (err) {
    console.error('[send-code] unexpected error:', err)
    return NextResponse.json({ error: '服务器内部错误，请稍后重试' }, { status: 500 })
  }
}
