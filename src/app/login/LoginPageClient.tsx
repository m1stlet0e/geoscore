'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { Sparkles, ShieldCheck, Mail, Phone } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { PhoneLoginForm } from './PhoneLoginForm'
import { OneClickLogin } from './OneClickLogin'

type LoginMethod = 'email' | 'phone'

export default function LoginPageClient() {
  const [method, setMethod] = useState<LoginMethod>('phone') // 默认手机号登录

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30" aria-hidden="true" />
      <div className="pointer-events-none fixed -top-32 left-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" aria-hidden="true" />

      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="返回首页">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="surface-raised rounded-2xl p-7 shadow-2xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">登录到 极排</h1>
            <p className="mt-1.5 text-sm text-neutral-500">继续监控你的 AI 可见性。</p>
          </div>

          <OneClickLogin />

          {/* 登录方式切换 */}
          <div className="mb-6 flex rounded-lg bg-neutral-100 p-1">
            <button
              onClick={() => setMethod('phone')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
                method === 'phone'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Phone className="h-4 w-4" />
              手机号登录
            </button>
            <button
              onClick={() => setMethod('email')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
                method === 'email'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Mail className="h-4 w-4" />
              邮箱登录
            </button>
          </div>

          {/* 登录表单 */}
          {method === 'phone' ? (
            <PhoneLoginForm callbackUrl="/dashboard" />
          ) : (
            <LoginForm callbackUrl="/dashboard" />
          )}

          {/* 注册链接 */}
          <div className="mt-4">
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              还没有账号? <span className="text-indigo-500">免费注册 →</span>
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            登录即表示你同意我们的服务条款与隐私政策。
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            永久免费版可用，无需预付。
          </div>
        </div>
      </div>
    </div>
  )
}
