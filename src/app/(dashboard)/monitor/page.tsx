import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { AI_PLATFORMS, getPlatformMeta } from '@/lib/constants';
import { cn, formatDate, pct } from '@/lib/utils';
import {
  ListChecks,
  Activity,
  TrendingUp,
  Plus,
  ArrowRight,
  Globe,
  CheckCircle2,
  Loader2,
  XCircle,
  Users,
  Sparkles,
} from 'lucide-react';
import { NewScanButton } from './_new-scan-button';

export const dynamic = 'force-dynamic';

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  queued: {
    label: '排队中',
    icon: <Loader2 className="h-3 w-3" />,
    cls: 'border-neutral-300 bg-neutral-100 text-neutral-500',
  },
  running: {
    label: '运行中',
    icon: <Activity className="h-3 w-3 animate-pulse" />,
    cls: 'border-indigo-500/30 bg-indigo-50 text-indigo-600',
  },
  completed: {
    label: '已完成',
    icon: <CheckCircle2 className="h-3 w-3" />,
    cls: 'border-emerald-500/30 bg-emerald-50 text-emerald-600',
  },
  failed: {
    label: '失败',
    icon: <XCircle className="h-3 w-3" />,
    cls: 'border-rose-500/30 bg-rose-50 text-rose-600',
  },
};

export default async function MonitorPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [brands, totalPrompts, scansThisMonth, scansPrevMonth, recentScans] = await Promise.all([
    prisma.brand.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { prompts: true, scans: true } },
        scans: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { startedAt: true, status: true },
        },
      },
    }),
    prisma.prompt.count({ where: { userId, isActive: true } }),
    prisma.scanRun.count({ where: { userId, startedAt: { gte: thirtyDaysAgo } } }),
    prisma.scanRun.count({
      where: { userId, startedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
    prisma.scanRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        brand: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Visibility score per brand (last 30d)
  const brandScores = await Promise.all(
    brands.map(async (b) => {
      const [m, t] = await Promise.all([
        prisma.promptScan.count({
          where: {
            scanRun: { brandId: b.id },
            createdAt: { gte: thirtyDaysAgo },
            brandMentioned: true,
          },
        }),
        prisma.promptScan.count({
          where: { scanRun: { brandId: b.id }, createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);
      return { brandId: b.id, mentioned: m, total: t, score: pct(m, t) };
    })
  );
  const scoreMap = new Map(brandScores.map((s) => [s.brandId, s]));

  // Average citation rate
  const totals = brandScores.reduce(
    (acc, s) => ({ m: acc.m + s.mentioned, t: acc.t + s.total }),
    { m: 0, t: 0 }
  );
  const avgCitationRate = pct(totals.m, totals.t);

  // Growth trend
  const growth =
    scansPrevMonth > 0
      ? Math.round(((scansThisMonth - scansPrevMonth) / scansPrevMonth) * 1000) / 10
      : scansThisMonth > 0
        ? 100
        : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="MODULE 1"
        title="AI 搜索监控中心"
        subtitle="实时追踪 7 大 AI 引擎对您品牌的引用、排名与情感变化。"
        actions={
          <NewScanButton
            brands={brands.map((b) => ({ id: b.id, name: b.name }))}
            platforms={AI_PLATFORMS.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
          />
        }
      />

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="总 Prompt 数"
          value={totalPrompts}
          icon={<ListChecks className="h-4 w-4" />}
          subline={`${brands.length} 个品牌`}
        />
        <StatCard
          label="本月扫描次数"
          value={scansThisMonth}
          icon={<Activity className="h-4 w-4" />}
          delta={growth}
          deltaLabel="vs 上月"
        />
        <StatCard
          label="平均引用率"
          value={`${avgCitationRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={avgCitationRate >= 30 ? 'positive' : 'default'}
          subline={`${totals.m} / ${totals.t} 提及`}
        />
        <StatCard
          label="增长趋势"
          value={growth > 0 ? `+${growth}%` : `${growth}%`}
          icon={<Sparkles className="h-4 w-4" />}
          tone={growth > 0 ? 'positive' : growth < 0 ? 'critical' : 'default'}
          subline="扫描频次对比上月"
        />
      </section>

      {/* Brand cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">品牌列表</h2>
            <p className="mt-0.5 text-xs text-neutral-500">点击管理 Prompts 查看每个品牌的扫描详情</p>
          </div>
        </div>

        {brands.length === 0 ? (
          <EmptyState
            icon={<Globe className="h-5 w-5" />}
            title="还没有添加任何品牌"
            description="从右上角新建一个扫描,GeoScore 会引导你创建第一个品牌。"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => {
              const score = scoreMap.get(brand.id);
              const scoreValue = score?.score ?? 0;
              const competitorsCount = Array.isArray(brand.competitors) ? brand.competitors.length : 0;
              const lastScan = brand.scans[0];
              return (
                <Link
                  key={brand.id}
                  href={`/monitor/${brand.id}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/40 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.15)]"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold text-neutral-900">
                        {brand.name}
                      </h3>
                      {brand.domain ? (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-500">
                          <Globe className="h-3 w-3" />
                          {brand.domain}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <div className="text-xs uppercase tracking-wider text-neutral-500">
                        Visibility
                      </div>
                      <div
                        className={cn(
                          'text-2xl font-semibold tabular-nums',
                          scoreValue >= 30
                            ? 'text-emerald-300'
                            : scoreValue >= 10
                              ? 'text-indigo-500'
                              : 'text-neutral-500'
                        )}
                      >
                        {scoreValue}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <ListChecks className="h-3 w-3" />
                      {brand._count.prompts} prompts
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {competitorsCount} 竞品
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {lastScan ? formatDate(lastScan.startedAt) : '未扫描'}
                    </span>
                  </div>

                  {/* Visibility bar */}
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        scoreValue >= 30
                          ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                          : scoreValue >= 10
                            ? 'bg-indigo-400'
                            : 'bg-gradient-to-r from-slate-500 to-slate-400'
                      )}
                      style={{ width: `${Math.max(2, scoreValue)}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-indigo-500 transition group-hover:gap-2">
                      管理 Prompts <ArrowRight className="h-3 w-3" />
                    </span>
                    <span className="text-neutral-500">
                      {score?.total ?? 0} 次扫描
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent scans table */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-800">最近扫描记录</h2>
          <span className="text-xs text-neutral-500">最近 10 条</span>
        </div>
        {recentScans.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500">暂无扫描记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-2 font-medium">品牌</th>
                  <th className="px-2 py-2 font-medium">平台</th>
                  <th className="px-2 py-2 font-medium">状态</th>
                  <th className="px-2 py-2 font-medium">完成度</th>
                  <th className="px-2 py-2 font-medium">触发方式</th>
                  <th className="px-2 py-2 font-medium">时间</th>
                  <th className="px-2 py-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/40">
                {recentScans.map((s) => {
                  const meta = STATUS_META[s.status] ?? STATUS_META.queued;
                  const progress = s.totalPrompts
                    ? Math.round((s.completedPrompts / s.totalPrompts) * 100)
                    : 0;
                  const platforms = Array.isArray(s.platforms) ? s.platforms : [];
                  return (
                    <tr key={s.id} className="transition hover:bg-neutral-100">
                      <td className="px-2 py-3">
                        <span className="font-medium text-neutral-800">{s.brand?.name ?? '-'}</span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-1">
                          {platforms.length === 0 ? (
                            <span className="text-neutral-500">-</span>
                          ) : (
                            platforms.slice(0, 3).map((pid) => {
                              const pm = getPlatformMeta(pid);
                              return (
                                <span
                                  key={pid}
                                  className="inline-flex items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
                                  style={{ borderColor: `${pm.color}40` }}
                                >
                                  {pm.name}
                                </span>
                              );
                            })
                          )}
                          {platforms.length > 3 ? (
                            <span className="text-[10px] text-neutral-500">+{platforms.length - 3}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                            meta.cls
                          )}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums text-neutral-500">
                            {s.completedPrompts}/{s.totalPrompts}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-xs text-neutral-500">
                        {s.triggeredBy === 'user' ? '手动' : s.triggeredBy === 'cron' ? '定时' : s.triggeredBy}
                      </td>
                      <td className="px-2 py-3 text-xs text-neutral-500">{formatDate(s.startedAt)}</td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          href={`/monitor/${s.brandId}`}
                          className="text-xs text-indigo-500 hover:text-indigo-600"
                        >
                          详情
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
