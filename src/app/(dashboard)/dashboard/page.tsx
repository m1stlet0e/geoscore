import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { prisma } from '@/lib/prisma';
import { getPlatformMeta } from '@/lib/constants';
import { cn, formatDate, pct } from '@/lib/utils';
import {
  Sparkles,
  Activity,
  Eye,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  Radar,
  ArrowRight,
  Zap,
  BarChart3,
  Globe,
  Plus,
  Search,
} from 'lucide-react';
import { CitationTrendChart, PlatformDistributionChart } from './_charts';
import { FadeIn, StaggerChildren, AnimatedNumber } from '@/components/animations';

export const dynamic = 'force-dynamic';

const SEVERITY_STYLES: Record<string, { ring: string; dot: string; text: string; label: string; bg: string }> = {
  high: { ring: 'border-rose-500/40', dot: 'bg-rose-500', text: 'text-rose-600', label: '高', bg: 'bg-rose-50' },
  medium: { ring: 'border-amber-500/40', dot: 'bg-amber-500', text: 'text-amber-600', label: '中', bg: 'bg-amber-50' },
  low: { ring: 'border-neutral-400/40', dot: 'bg-neutral-500', text: 'text-neutral-700', label: '低', bg: 'bg-neutral-50' },
};

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  queued: {
    label: '排队中',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    cls: 'border-neutral-200 bg-neutral-50 text-neutral-500',
  },
  running: {
    label: '运行中',
    icon: <Activity className="h-3 w-3 animate-pulse" />,
    cls: 'border-indigo-200 bg-indigo-50 text-indigo-600',
  },
  completed: {
    label: '已完成',
    icon: <CheckCircle2 className="h-3 w-3" />,
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-600',
  },
  failed: {
    label: '失败',
    icon: <XCircle className="h-3 w-3" />,
    cls: 'border-rose-200 bg-rose-50 text-rose-600',
  },
};

const ALERT_TYPE_LABEL: Record<string, string> = {
  visibility_drop: '可见性下降',
  new_competitor: '新竞品出现',
  gap_opened: '缺口打开',
  trend_rising: '趋势上升',
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;
  const userName = session.user.name || session.user.email || '用户';

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ---- Parallel DB queries, scoped to user ----
  const [
    brandCount,
    scanLast30,
    citationLast30,
    unreadAlertsCount,
    recentScans,
    recentAlerts,
    promptScanByDay,
    promptScanByPlatform,
  ] = await Promise.all([
    prisma.brand.count({ where: { userId } }),
    prisma.scanRun.count({ where: { userId, startedAt: { gte: thirtyDaysAgo } } }),
    prisma.citation.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.alert.count({ where: { userId, isRead: false } }),
    prisma.scanRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      include: { brand: { select: { name: true } } },
    }),
    prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { brand: { select: { name: true } } },
    }),
    prisma.citation.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, platform: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.promptScan.groupBy({
      by: ['platform'],
      where: {
        scanRun: { userId },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { _all: true },
    }),
  ]);

  // Aggregate citation trend by day (UTC+8 for China-local date grouping)
  const CST_OFFSET_MS = 8 * 60 * 60 * 1000;
  const toLocalDateKey = (date: Date) =>
    new Date(date.getTime() + CST_OFFSET_MS).toISOString().slice(0, 10);

  const trendMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = toLocalDateKey(d);
    trendMap.set(key, 0);
  }
  for (const c of promptScanByDay) {
    const key = toLocalDateKey(new Date(c.createdAt));
    if (trendMap.has(key)) trendMap.set(key, trendMap.get(key)! + 1);
  }
  const trendData = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

  // Platform distribution data for pie
  const platformData = promptScanByPlatform.map((row) => {
    const meta = getPlatformMeta(row.platform);
    return {
      id: row.platform,
      name: meta.name,
      value: row._count._all,
      color: meta.color,
    };
  });

  // Citation rate (30d)
  const [mentioned, total] = await Promise.all([
    prisma.promptScan.count({
      where: {
        scanRun: { userId },
        createdAt: { gte: thirtyDaysAgo },
        brandMentioned: true,
      },
    }),
    prisma.promptScan.count({
      where: { scanRun: { userId }, createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);
  const citationRate = total > 0 ? Math.round((mentioned / total) * 100) : 0;

  return (
    <div className="space-y-10 pb-12">
      {/* Header */}
      <FadeIn direction="down" duration={600}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">系统状态: 正常运行中</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-neutral-900 sm:text-5xl">
              你好, <span className="text-indigo-600">{userName.split(' ')[0]}</span>
            </h1>
            <p className="mt-3 text-lg font-medium text-neutral-500 max-w-xl">
              这是你品牌的 AI 可见性实时看板。目前正在监控 <span className="text-neutral-900 font-bold">{brandCount}</span> 个品牌。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/monitor"
              className="group inline-flex items-center gap-2 rounded-2xl border-2 border-neutral-100 bg-white px-6 py-3.5 text-sm font-bold text-neutral-900 transition-all hover:border-neutral-200 hover:shadow-lg active:scale-95"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" /> 新增扫描
            </Link>
            <Link
              href="/growth"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 text-sm font-black text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Sparkles className="h-4 w-4 fill-white" /> 增长建议
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* Bento Grid Stats */}
      <StaggerChildren staggerDelay={80}>
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Stat 1 */}
          <FadeIn>
            <div className="group relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:shadow-indigo-500/5">
              <div className="absolute -right-4 -top-4 opacity-[0.03] transition-transform group-hover:scale-110 group-hover:rotate-12">
                <Globe className="h-24 w-24 text-indigo-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Eye className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">总品牌数</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-neutral-900">
                    <AnimatedNumber value={brandCount} />
                  </span>
                  <span className="text-sm font-bold text-neutral-400">Brands</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '60%' }} />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-400">60% 额度</span>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Stat 2 */}
          <FadeIn>
            <div className="group relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:shadow-violet-500/5">
              <div className="absolute -right-4 -top-4 opacity-[0.03] transition-transform group-hover:scale-110 group-hover:rotate-12">
                <Radar className="h-24 w-24 text-violet-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Zap className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">本月扫描</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-neutral-900">
                    <AnimatedNumber value={scanLast30} />
                  </span>
                  <span className="text-sm font-bold text-neutral-400">Scans</span>
                </div>
                <p className="mt-4 text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> +12% 较上月
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Stat 3 */}
          <FadeIn>
            <div className="group relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:shadow-emerald-500/5">
              <div className="absolute -right-4 -top-4 opacity-[0.03] transition-transform group-hover:scale-110 group-hover:rotate-12">
                <TrendingUp className="h-24 w-24 text-emerald-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    citationRate >= 30 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  )}>
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">引用率</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-neutral-900">{citationRate}%</span>
                  <span className="text-sm font-bold text-neutral-400">Mention</span>
                </div>
                <p className="mt-4 text-xs font-bold text-neutral-400">
                  {mentioned} / {total} 次提及
                </p>
              </div>
            </div>
          </FadeIn>

          {/* Stat 4 */}
          <FadeIn>
            <div className="group relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:shadow-rose-500/5">
              <div className="absolute -right-4 -top-4 opacity-[0.03] transition-transform group-hover:scale-110 group-hover:rotate-12">
                <AlertCircle className="h-24 w-24 text-rose-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    unreadAlertsCount > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                  )}>
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">待处理警报</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-neutral-900">
                    <AnimatedNumber value={unreadAlertsCount} />
                  </span>
                  <span className="text-sm font-bold text-neutral-400">Alerts</span>
                </div>
                <p className={cn(
                  "mt-4 text-xs font-bold",
                  unreadAlertsCount > 0 ? "text-rose-600" : "text-emerald-600"
                )}>
                  {unreadAlertsCount > 0 ? '需要立即关注' : '目前一切平稳'}
                </p>
              </div>
            </div>
          </FadeIn>
        </section>
      </StaggerChildren>

      {/* Main Charts Section */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Trend Chart */}
        <FadeIn direction="up" delay={300} className="lg:col-span-2">
          <div className="h-full rounded-[2.5rem] border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-neutral-200/20">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-neutral-900">AI 引用趋势</h2>
                <p className="mt-1 text-sm font-medium text-neutral-400 uppercase tracking-widest">近 30 天每日提及次数</p>
              </div>
              <Link
                href="/citations"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-50 text-neutral-400 transition-all hover:bg-indigo-50 hover:text-indigo-600"
              >
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="h-[300px]">
              <CitationTrendChart data={trendData} />
            </div>
          </div>
        </FadeIn>

        {/* Platform Distribution */}
        <FadeIn direction="up" delay={400}>
          <div className="h-full rounded-[2.5rem] border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-neutral-200/20">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-neutral-900">平台曝光分布</h2>
                <p className="mt-1 text-sm font-medium text-neutral-400 uppercase tracking-widest">主流 AI 平台</p>
              </div>
            </div>
            <div className="h-[300px] flex items-center justify-center">
              {platformData.length === 0 ? (
                <div className="text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-neutral-50 mx-auto">
                    <BarChart3 className="h-8 w-8 text-neutral-200" />
                  </div>
                  <p className="text-sm font-bold text-neutral-400">暂无扫描数据</p>
                </div>
              ) : (
                <PlatformDistributionChart data={platformData} />
              )}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Bottom Activity Section */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent Scans */}
        <FadeIn delay={500}>
          <div className="rounded-[2.5rem] border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-neutral-200/20">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-xl font-black text-neutral-900">最近扫描任务</h2>
              <Link
                href="/monitor"
                className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                查看全部 →
              </Link>
            </div>
            {recentScans.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-neutral-50 mx-auto">
                  <Search className="h-8 w-8 text-neutral-200" />
                </div>
                <p className="text-sm font-bold text-neutral-400">暂无扫描记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentScans.map((s, i) => {
                  const meta = STATUS_META[s.status] ?? STATUS_META.queued;
                  const progress = s.totalPrompts
                    ? Math.round((s.completedPrompts / s.totalPrompts) * 100)
                    : 0;
                  return (
                    <div key={s.id} className="group flex items-center justify-between gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 p-4 transition-all hover:bg-white hover:shadow-md">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="truncate text-sm font-black text-neutral-900">
                            {s.brand?.name ?? '未知品牌'}
                          </span>
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
                              meta.cls
                            )}
                          >
                            {meta.icon}
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                          <span>{s.completedPrompts} / {s.totalPrompts} 完成</span>
                          <span className="h-1 w-1 rounded-full bg-neutral-200" />
                          <span>{formatDate(s.startedAt)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="text-sm font-black tabular-nums text-neutral-900">{progress}%</div>
                        <div className="h-1 w-16 rounded-full bg-neutral-100 overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </FadeIn>

        {/* Recent Alerts */}
        <FadeIn delay={600}>
          <div className="rounded-[2.5rem] border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-neutral-200/20">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-xl font-black text-neutral-900">实时智能警报</h2>
              <Link
                href="/alerts"
                className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                查看全部 →
              </Link>
            </div>
            {recentAlerts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-neutral-50 mx-auto">
                  <Zap className="h-8 w-8 text-neutral-200" />
                </div>
                <p className="text-sm font-bold text-neutral-400">暂无警报信息</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAlerts.map((a, i) => {
                  const sev = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.low;
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'group relative overflow-hidden rounded-2xl border border-neutral-100 p-4 transition-all hover:shadow-md',
                        !a.isRead ? "bg-white ring-2 ring-indigo-500/10" : "bg-neutral-50/50"
                      )}
                    >
                      <div className={cn('absolute left-0 top-0 h-full w-1.5', sev.dot)} />
                      <div className="flex items-start gap-4 pl-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn('text-[10px] font-black uppercase tracking-widest', sev.text)}>
                              {ALERT_TYPE_LABEL[a.type] ?? a.type}
                            </span>
                            {!a.isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            )}
                          </div>
                          <h4 className="truncate text-sm font-black text-neutral-900">
                            {a.title}
                          </h4>
                          <p className="mt-1 line-clamp-1 text-xs font-medium text-neutral-500">{a.message}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{relativeTime(a.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </FadeIn>
      </section>
    </div>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}M前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H前`;
  const day = Math.floor(h / 24);
  return `${day}D前`;
}
