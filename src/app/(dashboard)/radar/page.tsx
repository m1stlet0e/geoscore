import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, ArrowUpRight, Sparkles, Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { prisma } from '@/lib/prisma';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  question: '问题',
  topic: '话题',
  keyword: '关键词',
};

export default async function RadarPage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;
  const { brandId } = await searchParams;

  const brands = await prisma.brand.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const activeBrand = brandId ? brands.find((b) => b.id === brandId) || brands[0] : brands[0];

  const signals = await prisma.trendSignal.findMany({
    where: { userId, ...(activeBrand ? { brandId: activeBrand.id } : {}) },
    orderBy: { growthPct: 'desc' },
    take: 40,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prompt Radar"
        subtitle="实时发现新出现的问题、关键词、话题 — 提前抢占下一波 AI 搜索流量"
      />

      {/* Brand selector */}
      <div className="flex flex-wrap items-center gap-2">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/radar?brandId=${b.id}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition',
              b.id === activeBrand?.id
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200'
                : 'border-slate-800/60 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            )}
          >
            {b.name}
          </Link>
        ))}
        <Link
          href={`/radar?brandId=${activeBrand?.id || ''}`}
          className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-400 hover:border-slate-700"
        >
          <Plus className="h-3 w-3" /> 追踪新信号
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
          <div className="text-xs text-slate-400">活跃信号</div>
          <div className="mt-1 text-2xl font-semibold">{signals.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
          <div className="text-xs text-slate-400">高增长(≥100%)</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-200">
            {signals.filter((s) => s.growthPct >= 100).length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-5">
          <div className="text-xs text-slate-400">覆盖 AI 平台</div>
          <div className="mt-1 text-2xl font-semibold text-cyan-200">
            {new Set(signals.flatMap((s) => s.platforms)).size}
          </div>
        </div>
      </div>

      {/* Signal cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {signals.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
            <TrendingUp className="mx-auto h-8 w-8 text-cyan-400" />
            <h3 className="mt-4 text-lg font-medium">还没有趋势信号</h3>
            <p className="mt-2 text-sm text-slate-400">系统正在监控 7 大 AI 引擎,新问题出现时会自动提醒你</p>
          </div>
        ) : (
          signals.map((s) => (
            <div
              key={s.id}
              className="group rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 transition hover:border-cyan-500/30"
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300">
                  {CATEGORY_LABEL[s.category] || s.category}
                </span>
                <span className="ml-auto inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                  <ArrowUpRight className="h-3 w-3" />
                  {s.growthPct >= 999 ? '999+' : s.growthPct.toFixed(0)}%
                </span>
              </div>
              <h4 className="mt-2 line-clamp-2 text-sm font-medium text-slate-100">{s.text}</h4>
              <div className="mt-3 flex flex-wrap gap-1">
                {s.platforms.slice(0, 4).map((p) => (
                  <span key={p} className="rounded bg-slate-800/40 px-1.5 py-0.5 text-xs text-slate-400">
                    {p}
                  </span>
                ))}
                {s.platforms.length > 4 && (
                  <span className="text-xs text-slate-500">+{s.platforms.length - 4}</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Volume: {s.volume.toLocaleString()}</span>
                <Sparkles className="h-3 w-3 text-cyan-400 opacity-0 transition group-hover:opacity-100" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
