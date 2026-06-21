'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      const res = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? '邮箱或密码错误，请重试。');
        setLoading(false);
        return;
      }

      // 登录成功，跳转
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError('网络错误，请重试。');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} method="POST" className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-600">
          {error}
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-neutral-700">
          邮箱
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-medium text-neutral-700">
            密码
          </label>
          <a href="/forgot-password" className="text-xs text-indigo-500 hover:text-indigo-600">
            忘记密码?
          </a>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          placeholder="••••••••"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
