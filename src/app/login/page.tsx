import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Logo } from '@/components/Logo';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { LoginForm } from './LoginForm';

export const metadata = {
  title: '登录 · GeoScore',
  description: '登录 GeoScore,继续你的 AI 可见性监控。',
};

type SP = { redirect?: string; error?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  const errorMessage = (() => {
    switch (sp.error) {
      case 'invalid': return '邮箱或密码错误,请重试。';
      case 'missing': return '请填写邮箱和密码。';
      case 'CredentialsSignin': return '邮箱或密码错误。';
      default: return null;
    }
  })();

  const callbackUrl = sp.redirect || '/dashboard';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-radial-glow" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30" aria-hidden="true" />
      <div className="pointer-events-none fixed -top-32 left-1/2 -z-10 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" aria-hidden="true" />

      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="返回首页">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="glass-strong rounded-2xl p-7 shadow-2xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">登录到 GeoScore</h1>
            <p className="mt-1.5 text-sm text-slate-400">继续监控你的 AI 可见性。</p>
          </div>

          {errorMessage ? (
            <div role="alert" className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <LoginForm callbackUrl={callbackUrl} />

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-slate-500">
            <div className="h-px flex-1 bg-slate-800" />
            或
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <Link
            href="/register"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
          >
            还没有账号? <span className="text-indigo-300">免费注册 →</span>
          </Link>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            登录即表示你同意我们的服务条款与隐私政策。
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            永久免费版可用,无需信用卡。
          </div>
        </div>
      </div>
    </div>
  );
}
