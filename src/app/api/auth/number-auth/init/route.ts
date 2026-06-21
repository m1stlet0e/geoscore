// POST /api/auth/number-auth/init
// 初始化一键登录：获取 authToken → 返回 H5 跳转 URL

import { NextResponse } from 'next/server'
import { initOneClickLogin } from '@/lib/number-auth'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const callbackPath = body.callback || '/api/auth/number-auth/callback'

    const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 18200}`
    const callbackUrl = `${baseUrl}${callbackPath}`

    const result = await initOneClickLogin(callbackUrl)

    if (!result) {
      // 未配置或获取失败 → 前端 fallback 到短信验证码
      return NextResponse.json({ available: false }, { status: 200 })
    }

    return NextResponse.json({
      available: true,
      authUrl: result.authUrl,
      accessToken: result.accessToken,
    })
  } catch (err) {
    console.error('[number-auth init]', err)
    return NextResponse.json({ available: false, error: '服务暂不可用' }, { status: 500 })
  }
}
