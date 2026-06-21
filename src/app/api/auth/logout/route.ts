// 退出登录：清除 session cookie
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
