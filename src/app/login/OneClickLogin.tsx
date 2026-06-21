'use client'

import { useState } from 'react'
import { Smartphone, Loader2 } from 'lucide-react'

export function OneClickLogin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [available, setAvailable] = useState<boolean | null>(null)

  // 检测是否在移动端
  const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone/i.test(navigator.userAgent)

  // 页面加载时探测一键登录是否可用
  useState(() => {
    if (!isMobile) {
      setAvailable(false)
      return
    }
    fetch('/api/auth/number-auth/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback: '/api/auth/number-auth/callback' }),
    })
      .then(r => r.json())
      .then(d => setAvailable(d.available))
      .catch(() => setAvailable(false))
  })

  const handleOneClick = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/number-auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback: '/api/auth/number-auth/callback' }),
      })

      const data = await res.json()

      if (data.available && data.authUrl) {
        // 跳转到阿里云 H5 一键登录页
        window.location.href = data.authUrl
      } else {
        setError('一键登录暂不可用，请使用验证码登录')
        setAvailable(false)
      }
    } catch {
      setError('网络错误，请使用验证码登录')
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  // 不可用时隐藏
  if (available === false) return null

  return (
    <div className="mb-5">
      <button
        onClick={handleOneClick}
        disabled={loading || available === null}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-blue-600 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> 正在获取...</>
        ) : available === null ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> 检测中...</>
        ) : (
          <><Smartphone className="h-4 w-4" /> 本机号码一键登录</>
        )}
      </button>

      {error && (
        <p className="mt-2 text-center text-xs text-amber-600">{error}</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs text-neutral-400">其他登录方式</span>
        <div className="h-px flex-1 bg-neutral-200" />
      </div>
    </div>
  )
}
