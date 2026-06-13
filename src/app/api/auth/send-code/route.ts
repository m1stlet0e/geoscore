// ============================================
// 发送短信验证码 API
// POST /api/auth/send-code
// ============================================

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendSmsCode, generateCode, saveCode, canSendCode, markCodeSent } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const Body = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
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

  const { phone } = parsed.data

  // 检查发送频率
  if (!canSendCode(phone)) {
    return NextResponse.json(
      { error: '请稍后再试，1 分钟内只能发送 1 次' },
      { status: 429 }
    )
  }

  // 生成验证码
  const code = generateCode()

  // 发送短信
  const sent = await sendSmsCode(phone, code)
  
  if (!sent) {
    return NextResponse.json(
      { error: '短信发送失败，请稍后重试' },
      { status: 500 }
    )
  }

  // 保存验证码
  saveCode(phone, code)
  markCodeSent(phone)

  // 开发环境返回验证码（方便测试）
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({ 
      success: true, 
      message: '验证码已发送',
      devCode: code // 仅开发环境
    })
  }

  return NextResponse.json({ success: true, message: '验证码已发送' })
}
