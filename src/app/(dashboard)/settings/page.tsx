import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { prisma } from '@/lib/prisma';
import { PLAN_LIMITS } from '@/lib/constants';
import type { Plan } from '@prisma/client';
import { User as UserIcon, CreditCard, Key, Users, LogOut, Mail, Calendar } from 'lucide-react';
import { UpgradeButton } from './_upgrade-button';

export const dynamic = 'force-dynamic';

const PLAN_STYLE: Record<Plan, { label: string; cls: string; price: string }> = {
  FREE: { label: 'FREE', cls: 'border-neutral-300 bg-neutral-100 text-neutral-700', price: '$0' },
  PRO: { label: 'PRO', cls: 'border-indigo-500/30 bg-indigo-50 text-indigo-600', price: '$99/月' },
  GROWTH: { label: 'GROWTH', cls: 'border-violet-500/30 bg-violet-50 text-violet-600', price: '$299/月' },
  ENTERPRISE: { label: 'ENTERPRISE', cls: 'border-amber-500/30 bg-amber-50 text-amber-600', price: '$999/月' },
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect('/login');
  const plan = (user.plan || 'FREE') as Plan;
  const limits = PLAN_LIMITS[plan];

  const [brandCount, promptCount, scansToday] = await Promise.all([
    prisma.brand.count({ where: { userId } }),
    prisma.prompt.count({ where: { userId } }),
    prisma.scanRun.count({
      where: {
        userId,
        startedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  const fmt = (used: number, max: number) => (max === -1 ? '∞' : `${used} / ${max}`);

  return (
    <div className="space-y-6">
      <PageHeader title="账户设置" subtitle="管理你的账户、订阅与团队" />

      {/* Basic info */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-100 p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-neutral-300" />
          <h2 className="text-sm font-medium">基本信息</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="姓名" value={user.name || '—'} />
          <Field label="邮箱" value={user.email} icon={<Mail className="h-3.5 w-3.5" />} />
          <Field label="注册时间" value={new Date(user.createdAt).toLocaleString('zh-CN')} icon={<Calendar className="h-3.5 w-3.5" />} />
        </div>
      </section>

      {/* Plan */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-100 p-6">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-neutral-300" />
          <h2 className="text-sm font-medium">当前计划</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${PLAN_STYLE[plan].cls}`}>
            {PLAN_STYLE[plan].label}
          </span>
          <span className="text-sm text-neutral-500">{PLAN_STYLE[plan].price}</span>
          {user.planExpiresAt && (
            <span className="text-xs text-neutral-500">有效期至: {new Date(user.planExpiresAt).toLocaleDateString('zh-CN')}</span>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <UsageBar label="品牌数" used={fmt(brandCount, limits.brands)} pct={limits.brands === -1 ? 0 : Math.min(100, (brandCount / limits.brands) * 100)} />
          <UsageBar label="Prompts" used={fmt(promptCount, limits.prompts)} pct={limits.prompts === -1 ? 0 : Math.min(100, (promptCount / limits.prompts) * 100)} />
          <UsageBar label="今日扫描" used={fmt(scansToday, limits.scansPerDay)} pct={limits.scansPerDay === -1 ? 0 : Math.min(100, (scansToday / limits.scansPerDay) * 100)} />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-500">升级到:</span>
          {(['PRO', 'GROWTH', 'ENTERPRISE'] as Plan[]).filter((p) => p !== plan).map((p) => (
            <UpgradeButton key={p} plan={p} label={`${p} · ${PLAN_STYLE[p].price}`} />
          ))}
        </div>
      </section>

      {/* API */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-100 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-neutral-300" />
          <h2 className="text-sm font-medium">AI 引擎</h2>
        </div>
        <p className="text-sm text-neutral-500">
          GeoScore 由系统统一调度 DeepSeek / 7 大 AI 引擎,无需用户配置 API key。扫描频次由系统根据你的计划自动控制。
        </p>
      </section>

      {/* Team (placeholder) */}
      <section className="rounded-2xl border border-neutral-200 bg-neutral-100 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-neutral-300" />
          <h2 className="text-sm font-medium">团队</h2>
        </div>
        <p className="text-sm text-neutral-500">
          团队协作功能仅在 ENTERPRISE 计划中开放。升级后你可以邀请最多 20 名成员、设置角色权限、查看团队级 AI 可见性报表。
        </p>
      </section>

      {/* Sign out */}
      <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6">
        <h2 className="mb-3 text-sm font-medium text-rose-600">退出登录</h2>
        <form
          action={async () => {
            'use server';
            await signOut({ redirect: true, callbackUrl: '/login' });
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/20"
          >
            <LogOut className="h-3.5 w-3.5" /> 退出登录
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-neutral-500">{label}</div>
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white/40 px-3 py-2 text-sm text-neutral-700">
        {icon}
        {value}
      </div>
    </div>
  );
}

function UsageBar({ label, used, pct }: { label: string; used: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="text-neutral-300">{used}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
