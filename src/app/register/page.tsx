'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useToast } from '@/components/ui/Toaster';

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const planHint = search.get('plan') || 'free';
  const { success, error: showError } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({} as { error?: string }));

      if (!res.ok) {
        showError('注册失败', data?.error ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }

      success('账号创建成功', '正在为你登录...');

      // Auto sign-in after successful registration
      const signInRes = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        showError('已注册,但自动登录失败', '请回到登录页手动登录。');
        startTransition(() => {
          router.push('/login');
        });
        return;
      }

      startTransition(() => {
        router.push('/dashboard');
        router.refresh();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      showError('注册失败', msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30" aria-hidden="true" />
      <div className="pointer-events-none fixed -top-32 left-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" aria-hidden="true" />

      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="返回首页">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="surface-raised rounded-2xl p-7 shadow-2xl sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-3 py-1 text-[11px] text-indigo-600">
              30 秒接入 · 永久免费版
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">创建你的 GeoScore 账号</h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              {planHint === 'enterprise'
                ? '我们将为你开通 ENTERPRISE 试用,稍后销售会联系你。'
                : '注册即获得 1 个品牌 / 5 个关键词的免费监控。'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-neutral-300">
                姓名 / 品牌名(可选)
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="王波 / Acme Inc."
                className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-neutral-300">
                工作邮箱
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-neutral-300">
                设置密码(至少 8 位)
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-neutral-800 placeholder:text-neutral-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label={showPwd ? '隐藏密码' : '显示密码'}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength value={password} />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 创建中...
                </>
              ) : (
                <>免费创建账号</>
              )}
            </button>

            <p className="text-[11px] leading-relaxed text-neutral-500">
              点击"免费创建账号"即表示你同意我们的{' '}
              <Link href="/terms" className="text-indigo-500 hover:text-indigo-600">服务条款</Link>{' '}
              和{' '}
              <Link href="/privacy" className="text-indigo-500 hover:text-indigo-600">隐私政策</Link>。
            </p>
          </form>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-neutral-500">
            <div className="h-px flex-1 bg-neutral-200" />
            已有账号?
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
          >
            返回登录 <span className="text-indigo-500">→</span>
          </Link>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            密码使用 bcrypt 加盐存储,会话采用 NextAuth JWT。
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            立即获得 1 个默认品牌 + 5 个免费关键词。
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const score = scorePassword(value);
  const labels = ['太弱', '偏弱', '一般', '良好', '很强'];
  const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];
  const text = ['text-rose-300', 'text-orange-300', 'text-amber-300', 'text-emerald-300', 'text-emerald-300'];

  if (!value) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex h-1.5 flex-1 gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-full flex-1 rounded-full transition ${i < score ? colors[score] : 'bg-neutral-200'}`}
          />
        ))}
      </div>
      <div className={`min-w-[3rem] text-right text-[10px] font-medium ${text[score]}`}>
        {labels[score]}
      </div>
    </div>
  );
}

function scorePassword(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.max(1, Math.min(4, s));
}

import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">加载中...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
