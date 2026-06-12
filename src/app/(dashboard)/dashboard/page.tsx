import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { AI_PLATFORMS, getPlatformMeta } from '@/lib/constants';
import { cn, formatNumber, formatDate, pct } from '@/lib/utils';
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
} from 'lucide-react';
import { CitationTrendChart, PlatformDistributionChart } from './_charts';

export const dynamic = 'force-dynamic';

const SEVERITY_STYLES: Record<string, { ring: string; dot: string; text: string; label: string }> = {
  high: { ring: 'border-rose-500/40', dot: 'bg-rose-400', text: 'text-rose-600', label: '高' },
  medium: { ring: 'border-amber-500/40', dot: 'bg-amber-400', text: 'text-amber-600', label: '中' },
  low: { ring: 'border-neutral-400/40', dot: 'bg-neutral-500', text: 'text-neutral-700', label: '低' },
};

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  queued: {
    label: '排队中',
    icon: <Loader2 className="h-3 w-3" />,
    cls: 'border-neutral-300 bg-neutral-100 text-neutral-300',
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
    // citation trend by day — fetch last 30d then bucket in JS to keep it simple
    prisma.citation.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, platform: true },
      orderBy: { createdAt: 'asc' },
    }),
    // platform distribution for pie chart (from prompt scans)
    prisma.promptScan.groupBy({
      by: ['platform'],
      where: {
        scanRun: { userId },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { _all: true },
    }),
  ]);

  // Aggregate citation trend by day
  const trendMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, 0);
  }
  for (const c of promptScanByDay) {
    const key = new Date(c.createdAt).toISOString().slice(0, 10);
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

  // Citation rate (30d): % of prompt scans where brandMentioned=true
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
  const citationRate = pct(mentioned, total);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="DASHBOARD"
        title={`欢迎回来,${userName}`}
        subtitle="这是你品牌的 AI 可见性总览。开始添加品牌、配置 prompt,让 AI 主动提起你。"
        actions={
          <>
            <Link
              href="/monitor"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              <Activity className="h-4 w-4 text-indigo-500" /> 查看监控
            </Link>
            <Link
              href="/alerts"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
            >
              <Sparkles className="h-4 w-4" /> 智能预警
            </Link>
          </>
        }
      />

      {/* Stat cards row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="总品牌数"
          value={brandCount}
          icon={<Eye className="h-4 w-4" />}
          subline={brandCount > 0 ? '监控中' : '前往监控中心添加'}
        />
        <StatCard
          label="本月扫描"
          value={scanLast30}
          icon={<Radar className="h-4 w-4" />}
          subline="近 30 天"
        />
        <StatCard
          label="引用率"
          value={`${citationRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={citationRate >= 30 ? 'positive' : citationRate >= 10 ? 'default' : 'warning'}
          subline={`${mentioned} / ${total} 次提及`}
        />
        <StatCard
          label="待处理警报"
          value={unreadAlertsCount}
          icon={<AlertCircle className="h-4 w-4" />}
          tone={unreadAlertsCount > 0 ? 'warning' : 'positive'}
          subline={unreadAlertsCount > 0 ? '需要关注' : '一切平稳'}
        />
      </section>

      {/* Charts row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-800">AI 引用趋势</h2>
              <p className="mt-0.5 text-xs text-neutral-500">近 30 天每日提及次数</p>
            </div>
            <Link
              href="/citations"
              className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600"
            >
              查看详情 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <CitationTrendChart data={trendData} />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-800">7 大 AI 平台曝光分布</h2>
              <p className="mt-0.5 text-xs text-neutral-500">近 30 天扫描分布</p>
            </div>
          </div>
          {platformData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-sm text-neutral-500">
              暂无扫描数据
            </div>
          ) : (
            <PlatformDistributionChart data={platformData} />
          )}
        </div>
      </section>

      {/* Recent activity row */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Recent scans */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-800">最近扫描</h2>
            <Link
              href="/monitor"
              className="text-xs text-indigo-500 hover:text-indigo-600"
            >
              查看全部 →
            </Link>
          </div>
          {recentScans.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">暂无扫描记录</div>
          ) : (
            <ul className="divide-y divide-neutral-200">
              {recentScans.map((s) => {
                const meta = STATUS_META[s.status] ?? STATUS_META.queued;
                const progress = s.totalPrompts
                  ? Math.round((s.completedPrompts / s.totalPrompts) * 100)
                  : 0;
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-3 transition hover:px-1"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-neutral-800">
                          {s.brand?.name ?? '未知品牌'}
                        </span>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                            meta.cls
                          )}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                        <span>{s.completedPrompts} / {s.totalPrompts} 完成</span>
                        <span>·</span>
                        <span>{formatDate(s.startedAt)}</span>
                      </div>
                    </div>
                    <div className="text-xs tabular-nums text-neutral-500">{progress}%</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent alerts */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-800">最新警报</h2>
            <Link
              href="/alerts"
              className="text-xs text-indigo-500 hover:text-indigo-600"
            >
              查看全部 →
            </Link>
          </div>
          {recentAlerts.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-500">暂无警报</div>
          ) : (
            <ul className="space-y-2">
              {recentAlerts.map((a) => {
                const sev = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.low;
                return (
                  <li
                    key={a.id}
                    className={cn(
                      'group relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 p-3 transition hover:border-neutral-300',
                      !a.isRead && 'ring-1 ring-indigo-500/20'
                    )}
                  >
                    <div className={cn('absolute left-0 top-0 h-full w-0.5', sev.dot)} />
                    <div className="flex items-start gap-2 pl-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] font-semibold uppercase tracking-wider', sev.text)}>
                            {ALERT_TYPE_LABEL[a.type] ?? a.type}
                          </span>
                          {!a.isRead ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-sm font-medium text-neutral-800">
                          {a.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{a.message}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-neutral-500">{relativeTime(a.createdAt)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function relativeTime(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  return `${day} 天前`;
}
