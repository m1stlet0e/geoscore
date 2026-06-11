'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Quote,
  Activity,
  Globe,
  Link2,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  PieChart as PieChartIcon,
  Network,
  ArrowUpRight,
  ArrowDownRight,
  Database,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

// ─── Types ───────────────────────────────────────────────────────────────────

type Trend = 'up' | 'down' | 'stable';

interface Stats {
  totalCitations: number;
  avgAiScore: number;
  topPlatform: string;
  topSource: string;
  recentTrend: Trend;
}

interface Citation {
  id: string;
  platform: string;
  promptText: string;
  aiScore: number;
  brandRank: number | null;
  createdAt: string;
  sources?: Array<{ domain?: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SourceItem {
  id: string;
  domain: string;
  type: string;
  weight: number;
  citationCount: number;
  influenceScore: number;
}

interface TrendData {
  dates: string[];
  citationCounts: number[];
  aiScores: number[];
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

type Tab = 'overview' | 'sources' | 'network' | 'trends';

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#3b82f6',
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#eab308',
  chart: ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6'],
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'sources', label: '来源分析' },
  { key: 'network', label: '影响力网络' },
  { key: 'trends', label: '趋势' },
];

// ─── Skeleton Components ─────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800 ${className}`} />;
}

function StatCardsSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5"
        >
          <SkeletonPulse className="h-3 w-20 mb-3" />
          <SkeletonPulse className="h-8 w-24 mb-3" />
          <SkeletonPulse className="h-3 w-32" />
        </div>
      ))}
    </section>
  );
}

function ChartSkeleton({ height = 'h-[320px]' }: { height?: string }) {
  return (
    <div className={`${height} w-full flex items-center justify-center`}>
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Activity className="h-6 w-6 animate-pulse" />
        <span className="text-xs">加载图表中...</span>
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <SkeletonPulse className="h-4 w-8" />
          <SkeletonPulse className="h-4 flex-1" />
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Chart Tooltip Style ─────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 8,
  fontSize: 12,
};

const labelStyle = { color: '#94a3b8' };

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function CitationsIntelligencePage() {
  const [brandId, setBrandId] = useState<string>('default-brand');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Data states
  const [stats, setStats] = useState<Stats | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [trend, setTrend] = useState<TrendData | null>(null);

  // Loading states
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingCitations, setLoadingCitations] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);

  // Error states
  const [error, setError] = useState<string | null>(null);

  // ─── Fetchers ────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await fetch(`/api/citations/stats?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching citation stats:', err);
      setError('加载统计数据失败');
    } finally {
      setLoadingStats(false);
    }
  }, [brandId]);

  const fetchCitations = useCallback(
    async (page = 1) => {
      try {
        setLoadingCitations(true);
        const res = await fetch(
          `/api/citations?brandId=${brandId}&page=${page}&limit=20`
        );
        if (!res.ok) throw new Error('Failed to fetch citations');
        const data = await res.json();
        setCitations(data.citations ?? []);
        setPagination(data.pagination ?? null);
      } catch (err) {
        console.error('Error fetching citations:', err);
      } finally {
        setLoadingCitations(false);
      }
    },
    [brandId]
  );

  const fetchSources = useCallback(async () => {
    try {
      setLoadingSources(true);
      const res = await fetch(`/api/citations/sources?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch sources');
      const data = await res.json();
      setSources(data.sources ?? []);
    } catch (err) {
      console.error('Error fetching citation sources:', err);
    } finally {
      setLoadingSources(false);
    }
  }, [brandId]);

  const fetchTrend = useCallback(async () => {
    try {
      setLoadingTrend(true);
      const res = await fetch(`/api/citations/trend?brandId=${brandId}&days=30`);
      if (!res.ok) throw new Error('Failed to fetch trend');
      const data = await res.json();
      setTrend(data);
    } catch (err) {
      console.error('Error fetching citation trend:', err);
    } finally {
      setLoadingTrend(false);
    }
  }, [brandId]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
    fetchCitations();
    fetchSources();
    fetchTrend();
  }, [fetchStats, fetchCitations, fetchSources, fetchTrend]);

  // ─── Derived Data ────────────────────────────────────────────────────────

  const aiScoreTrendData = trend
    ? trend.dates.map((date, i) => ({
        date: date.slice(5),
        aiScore: trend.aiScores[i],
      }))
    : [];

  const citationCountTrendData = trend
    ? trend.dates.map((date, i) => ({
        date: date.slice(5),
        count: trend.citationCounts[i],
      }))
    : [];

  const sentimentData = trend
    ? [
        { name: '正面', value: trend.sentimentDistribution.positive, color: COLORS.positive },
        { name: '中性', value: trend.sentimentDistribution.neutral, color: COLORS.neutral },
        { name: '负面', value: trend.sentimentDistribution.negative, color: COLORS.negative },
      ].filter((d) => d.value > 0)
    : [];

  const sourceTypeData = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + s.citationCount;
    return acc;
  }, {});
  const sourceTypePieData = Object.entries(sourceTypeData).map(([name, value], i) => ({
    name,
    value,
    color: COLORS.chart[i % COLORS.chart.length],
  }));

  const hasData =
    (stats && stats.totalCitations > 0) || citations.length > 0;

  // ─── Trend Icon ──────────────────────────────────────────────────────────

  const TrendIcon =
    stats?.recentTrend === 'up'
      ? ArrowUpRight
      : stats?.recentTrend === 'down'
        ? ArrowDownRight
        : Minus;

  const trendTone =
    stats?.recentTrend === 'up'
      ? 'positive'
      : stats?.recentTrend === 'down'
        ? 'critical'
        : 'default';

  // ─── Empty State ─────────────────────────────────────────────────────────

  if (!loadingStats && !loadingCitations && !hasData && !error) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="CITATION INTELLIGENCE"
          title="Citation Intelligence"
          subtitle="谁在影响 AI 推荐你的品牌"
        />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/60">
            <Database className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200">暂无引用数据</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            完成至少一次 AI 扫描后，这里会展示品牌在 AI 平台中的引用情况、来源分析和影响力趋势。
          </p>
          <a
            href="/monitor"
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
          >
            <Activity className="h-4 w-4" /> 前往监控中心
          </a>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="CITATION INTELLIGENCE"
        title="Citation Intelligence"
        subtitle="谁在影响 AI 推荐你的品牌"
      />

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      {loadingStats ? (
        <StatCardsSkeleton />
      ) : stats ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="总引用数"
            value={stats.totalCitations.toLocaleString()}
            icon={<Quote className="h-4 w-4" />}
            subline="全部平台"
          />
          <StatCard
            label="平均 AI 评分"
            value={stats.avgAiScore.toFixed(1)}
            icon={<Activity className="h-4 w-4" />}
            tone={stats.avgAiScore >= 70 ? 'positive' : stats.avgAiScore >= 40 ? 'default' : 'warning'}
            subline="满分 100"
          />
          <StatCard
            label="主要平台"
            value={stats.topPlatform || '-'}
            icon={<Globe className="h-4 w-4" />}
            subline="最高引用平台"
          />
          <StatCard
            label="主要来源"
            value={stats.topSource || '-'}
            icon={<Link2 className="h-4 w-4" />}
            subline="最高引用来源"
          />
          <StatCard
            label="趋势"
            value={
              stats.recentTrend === 'up'
                ? '上升'
                : stats.recentTrend === 'down'
                  ? '下降'
                  : '持平'
            }
            icon={<TrendIcon className="h-4 w-4" />}
            tone={trendTone}
            subline="近 30 天趋势"
          />
        </section>
      ) : null}

      {/* Tab Navigation */}
      <nav className="flex gap-1 rounded-xl border border-slate-800/60 bg-slate-900/40 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-200 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ─── Tab: Overview ──────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Charts row */}
          <section className="grid gap-4 lg:grid-cols-2">
            {/* AI Score Trend */}
            <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-100">AI 评分趋势</h2>
                <p className="mt-0.5 text-xs text-slate-400">近 30 天每日 AI 评分变化</p>
              </div>
              {loadingTrend ? (
                <ChartSkeleton />
              ) : aiScoreTrendData.length === 0 ? (
                <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">
                  暂无趋势数据
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aiScoreTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="aiScoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={32} domain={[0, 100]} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                      <Line
                        type="monotone"
                        dataKey="aiScore"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: COLORS.primary }}
                        name="AI 评分"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Citation Count Bar Chart */}
            <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-100">每日引用次数</h2>
                <p className="mt-0.5 text-xs text-slate-400">近 30 天引用量分布</p>
              </div>
              {loadingTrend ? (
                <ChartSkeleton />
              ) : citationCountTrendData.length === 0 ? (
                <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">
                  暂无引用数据
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={citationCountTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={32} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                      <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="引用次数" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          {/* Recent Citations Table */}
          <section className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-100">最近引用</h2>
              {pagination && (
                <span className="text-xs text-slate-500">
                  共 {pagination.total} 条
                </span>
              )}
            </div>
            {loadingCitations ? (
              <TableSkeleton rows={8} />
            ) : citations.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center text-sm text-slate-500">
                <Quote className="mb-2 h-6 w-6 text-slate-600" />
                暂无引用记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800/60 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2.5 font-medium">平台</th>
                      <th className="px-3 py-2.5 font-medium">Prompt</th>
                      <th className="px-3 py-2.5 font-medium text-center">AI 评分</th>
                      <th className="px-3 py-2.5 font-medium text-center">品牌排名</th>
                      <th className="px-3 py-2.5 font-medium text-right">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {citations.map((c) => {
                      const scoreTone =
                        c.aiScore >= 70
                          ? 'text-emerald-300'
                          : c.aiScore >= 40
                            ? 'text-slate-300'
                            : 'text-rose-300';
                      return (
                        <tr key={c.id} className="transition hover:bg-slate-900/30">
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center rounded border border-slate-700/60 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300">
                              {c.platform}
                            </span>
                          </td>
                          <td className="max-w-md px-3 py-3">
                            <p className="line-clamp-1 text-sm text-slate-200">
                              {c.promptText?.length > 80
                                ? c.promptText.slice(0, 80) + '…'
                                : c.promptText}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`font-mono text-sm font-semibold ${scoreTone}`}>
                              {c.aiScore.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {c.brandRank ? (
                              <span className="font-mono text-indigo-300">#{c.brandRank}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-slate-400">
                            {new Date(c.createdAt).toLocaleDateString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => fetchCitations(p)}
                    className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-medium transition ${
                      p === pagination.page
                        ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ─── Tab: Sources ───────────────────────────────────────────────── */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-5">
            {/* Source Type Pie Chart */}
            <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5 lg:col-span-2">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-100">来源类型分布</h2>
                <p className="mt-0.5 text-xs text-slate-400">按引用次数统计</p>
              </div>
              {loadingSources ? (
                <ChartSkeleton />
              ) : sourceTypePieData.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-sm text-slate-500">
                  <PieChartIcon className="mb-2 h-6 w-6 text-slate-600" />
                  暂无来源类型数据
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceTypePieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {sourceTypePieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={labelStyle}
                        formatter={(value: number, name: string) => [`${value} 次`, name]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top Sources Table */}
            <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5 lg:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-100">Top 引用来源</h2>
                <span className="text-xs text-slate-500">按影响力排序</span>
              </div>
              {loadingSources ? (
                <TableSkeleton rows={8} />
              ) : sources.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-sm text-slate-500">
                  <Link2 className="mb-2 h-6 w-6 text-slate-600" />
                  暂无来源数据
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-800/60 text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-3 py-2.5 font-medium">#</th>
                        <th className="px-3 py-2.5 font-medium">域名</th>
                        <th className="px-3 py-2.5 font-medium">类型</th>
                        <th className="px-3 py-2.5 font-medium text-center">权重</th>
                        <th className="px-3 py-2.5 font-medium text-center">引用次数</th>
                        <th className="px-3 py-2.5 font-medium text-center">影响力</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {sources.map((s, i) => {
                        const maxInfluence = sources[0]?.influenceScore ?? 1;
                        const width = maxInfluence > 0 ? (s.influenceScore / maxInfluence) * 100 : 0;
                        return (
                          <tr key={s.id} className="transition hover:bg-slate-900/30">
                            <td className="px-3 py-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900/40 text-[10px] font-semibold text-slate-400">
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-sm font-medium text-slate-100">{s.domain}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300">
                                {s.type}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-xs text-slate-300">
                              {s.weight.toFixed(1)}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-xs text-indigo-300">
                              {s.citationCount}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800/70">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                    style={{ width: `${width}%` }}
                                  />
                                </div>
                                <span className="shrink-0 text-xs tabular-nums text-slate-400">
                                  {s.influenceScore.toFixed(1)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ─── Tab: Network ───────────────────────────────────────────────── */}
      {activeTab === 'network' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-8">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/60">
                <Network className="h-7 w-7 text-slate-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-200">影响力网络图</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                即将推出：以可视化网络图展示品牌在各 AI 平台和来源中的影响力关系。敬请期待。
              </p>
            </div>
          </section>
        </div>
      )}

      {/* ─── Tab: Trends ────────────────────────────────────────────────── */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Citation Count & AI Score Line Charts */}
          <section className="grid gap-4 lg:grid-cols-2">
            {/* Citation Count Over Time */}
            <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-100">引用次数趋势</h2>
                <p className="mt-0.5 text-xs text-slate-400">近 30 天引用次数变化</p>
              </div>
              {loadingTrend ? (
                <ChartSkeleton />
              ) : citationCountTrendData.length === 0 ? (
                <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">
                  暂无趋势数据
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={citationCountTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="citationCountGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLORS.positive} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={COLORS.positive} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={32} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke={COLORS.positive}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: COLORS.positive }}
                        name="引用次数"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* AI Score Over Time */}
            <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-100">AI 评分趋势</h2>
                <p className="mt-0.5 text-xs text-slate-400">近 30 天 AI 评分变化</p>
              </div>
              {loadingTrend ? (
                <ChartSkeleton />
              ) : aiScoreTrendData.length === 0 ? (
                <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">
                  暂无趋势数据
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aiScoreTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="aiScoreGradient2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        minTickGap={24}
                      />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={32} domain={[0, 100]} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                      <Line
                        type="monotone"
                        dataKey="aiScore"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: COLORS.primary }}
                        name="AI 评分"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          {/* Sentiment Donut Chart */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5 lg:col-span-1">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-slate-100">情感分布</h2>
                <p className="mt-0.5 text-xs text-slate-400">引用内容的情感倾向</p>
              </div>
              {loadingTrend ? (
                <ChartSkeleton height="h-[280px]" />
              ) : sentimentData.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-sm text-slate-500">
                  <BarChart3 className="mb-2 h-6 w-6 text-slate-600" />
                  暂无情感数据
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {sentimentData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={labelStyle}
                        formatter={(value: number, name: string) => {
                          const total = sentimentData.reduce((s, d) => s + d.value, 0);
                          return [`${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`, name];
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Sentiment Summary Cards */}
            <div className="lg:col-span-2">
              {loadingTrend ? (
                <StatCardsSkeleton />
              ) : trend ? (
                <div className="grid gap-4 sm:grid-cols-3 h-full">
                  <StatCard
                    label="正面情感"
                    value={trend.sentimentDistribution.positive}
                    icon={<TrendingUp className="h-4 w-4" />}
                    tone="positive"
                    subline="积极推荐"
                  />
                  <StatCard
                    label="中性情感"
                    value={trend.sentimentDistribution.neutral}
                    icon={<Minus className="h-4 w-4" />}
                    subline="客观陈述"
                  />
                  <StatCard
                    label="负面情感"
                    value={trend.sentimentDistribution.negative}
                    icon={<TrendingDown className="h-4 w-4" />}
                    tone="critical"
                    subline="需要关注"
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
