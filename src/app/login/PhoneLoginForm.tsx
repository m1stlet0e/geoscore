'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, ShieldCheck, Loader2 } from 'lucide-react'

interface PhoneLoginFormProps {
  callbackUrl: string
}

export function PhoneLoginForm({ callbackUrl }: PhoneLoginFormProps) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [devCode, setDevCode] = useState('')

  // 发送验证码
  const handleSendCode = async () => {
    if (sending || countdown > 0) return
    
    setError('')
    setSending(true)

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '发送失败')
        return
      }

      // 开发环境显示验证码
      if (data.devCode) {
        setDevCode(data.devCode)
      }

      setStep('code')
      
      // 开始倒计时
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)

    } catch (err) {
      setError('网络错误，请重试')
    } finally {
      setSending(false)
    }
  }

  // 提交登录
  const handleSubmit = async () => {
    if (submitting) return
    
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, name })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '登录失败')
        return
      }

      // 登录成功，跳转到仪表盘
      router.push(callbackUrl)
      router.refresh()

    } catch (err) {
      setError('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {step === 'phone' ? (
        <>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-xs font-medium text-neutral-700">
              手机号
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                maxLength={11}
                className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <div>
            <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-neutral-700">
              姓名（选填，新用户注册时使用）
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你的名字或品牌名"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <button
            onClick={handleSendCode}
            disabled={phone.length !== 11 || sending || countdown > 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 发送中...
              </>
            ) : countdown > 0 ? (
              `${countdown} 秒后重试`
            ) : (
              '发送验证码'
            )}
          </button>
        </>
      ) : (
        <>
          <div className="text-center text-sm text-neutral-600">
            验证码已发送至 <span className="font-medium">{phone}</span>
          </div>

          <div>
            <label htmlFor="code" className="mb-1.5 block text-xs font-medium text-neutral-700">
              验证码
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="请输入 6 位验证码"
                maxLength={6}
                className="w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          {/* 开发环境显示验证码 */}
          {devCode && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              开发环境验证码：{devCode}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={code.length !== 6 || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 登录中...
              </>
            ) : (
              '登录 / 注册'
            )}
          </button>

          <button
            onClick={() => {
              setStep('phone')
              setCode('')
              setError('')
            }}
            className="w-full text-sm text-neutral-500 hover:text-neutral-700"
          >
            ← 返回修改手机号
          </button>
        </>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-600">
          {error}
        </div>
      )}
    </div>
  )
}
