'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle,
  Activity,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Clock,
  X,
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  Loader2,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { normalizeGapAnalysis, normalizePagination } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Trend = 'up' | 'down' | 'stable';
type Tab = 'list' | 'detail' | 'tracking';
type AnalysisStatus = 'pending' | 'analyzing' | 'completed';
type GapStatus = 'open' | 'in_progress' | 'resolved';

interface Summary {
  totalAnalyses: number;
  avgGap: number;
  biggestGap: number;
  openItems: number;
  topGapType: string;
  trend: Trend;
}

interface GapItem {
  id: string;
  priority: number;
  type: string;
  title: string;
  description: string;
  impact: number;
  status: GapStatus;
}

interface Analysis {
  id: string;
  platform: string;
  promptText: string;
  score: number;
  benchmarkScore: number;
  gap: number;
  status: AnalysisStatus;
  createdAt: string;
  gapItems?: GapItem[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  chatgpt: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', label: 'ChatGPT' },
  gemini: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', label: 'Gemini' },
  claude: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30', label: 'Claude' },
  deepseek: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30', label: 'DeepSeek' },
  perplexity: { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30', label: 'Perplexity' },
};

const STATUS_STYLES: Record<AnalysisStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-neutral-500/15', text: 'text-neutral-500', label: '待处理' },
  analyzing: { bg: 'bg-amber-500/15', text: 'text-amber-300', label: '分析中' },
  completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: '已完成' },
};

const GAP_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  faq: { bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  comparison: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  use_case: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  schema: { bg: 'bg-indigo-50', text: 'text-indigo-500', border: 'border-indigo-500/30' },
  media: { bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30' },
  github: { bg: 'bg-neutral-500/15', text: 'text-neutral-500', border: 'border-neutral-300' },
  readme: { bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  blog: { bg: 'bg-teal-500/15', text: 'text-teal-300', border: 'border-teal-500/30' },
  reddit: { bg: 'bg-red-500/15', text: 'text-red-300', border: 'border-red-500/30' },
};

const GAP_STATUS_OPTIONS: { value: GapStatus; label: string }[] = [
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'resolved', label: '已解决' },
];

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#6366f1', '#ec4899', '#64748b', '#f97316', '#14b8a6', '#ef4444'];

const TABS: { key: Tab; label: string }[] = [
  { key: 'list', label: '分析列表' },
  { key: 'detail', label: '差距详情' },
  { key: 'tracking', label: '改进跟踪' },
];

const PLATFORMS = ['chatgpt', 'gemini', 'claude', 'deepseek', 'perplexity'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score < 40) return 'text-rose-300';
  if (score <= 70) return 'text-amber-300';
  return 'text-emerald-300';
}

function getScoreBarColor(score: number): string {
  if (score < 40) return 'from-rose-500 to-rose-400';
  if (score <= 70) return 'from-amber-500 to-amber-400';
  return 'from-emerald-500 to-emerald-400';
}

function getPriorityStyle(p: number): { bg: string; text: string } {
  if (p === 1) return { bg: 'bg-rose-500/15', text: 'text-rose-300' };
  if (p === 2) return { bg: 'bg-orange-500/15', text: 'text-orange-300' };
  if (p <= 5) return { bg: 'bg-amber-500/15', text: 'text-amber-300' };
  return { bg: 'bg-neutral-500/15', text: 'text-neutral-500' };
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} />;
}

function StatCardsSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-neutral-200 bg-white p-5"
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
      <div className="flex flex-col items-center gap-3 text-neutral-500">
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

function AnalysisCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <SkeletonPulse className="h-5 w-16 rounded-full" />
            <SkeletonPulse className="h-5 w-12 rounded-full" />
          </div>
          <SkeletonPulse className="h-4 w-3/4" />
          <div className="flex gap-4">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-4 w-20" />
          </div>
        </div>
        <SkeletonPulse className="h-8 w-20 rounded-lg" />
      </div>
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

export default function GapsPage() {
  const [brandId, setBrandId] = useState<string>('');
  const [brands, setBrands] = useState<{ id: string; name: string; domain: string | null }[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [platformFilter, setPlatformFilter] = useState<string>('');

  // Data states
  const [summary, setSummary] = useState<Summary | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newPlatform, setNewPlatform] = useState('chatgpt');
  const [newPromptText, setNewPromptText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Expanded descriptions
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // Error state
  const [error, setError] = useState<string | null>(null);
  // Fetch brands
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/brands');
        if (!res.ok) return;
        const data = await res.json();
        const list = data.brands || [];
        setBrands(list);
        if (list.length > 0 && !brandId) {
          setBrandId(list[0].id);
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    })();
  }, []);

  // ─── Fetchers ────────────────────────────────────────────────────────────
  // ─── Fetchers ────────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {


      if (!brandId) return;
    try {
      setLoadingSummary(true);
      const res = await fetch(`/api/gaps/summary?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      const raw = data.data ?? data;
      setSummary({
        totalAnalyses: raw.totalAnalyses ?? raw.summary?.totalGaps ?? 0,
        avgGap: raw.avgGap ?? raw.summary?.avgScore ?? 0,
        biggestGap: raw.biggestGap ?? 0,
        openItems: raw.openItems ?? 0,
        topGapType: raw.topGapType ?? '-',
        trend:
          raw.trend === 'improving' || raw.trend === 'up'
            ? 'up'
            : raw.trend === 'worsening' || raw.trend === 'down'
              ? 'down'
              : 'stable',
      });
    } catch (err) {
      console.error('Error fetching gap summary:', err);
      setError('加载统计数据失败');
    } finally {
      setLoadingSummary(false);
    }
  }, [brandId]);

  const fetchAnalyses = useCallback(
    async (page = 1) => {
      if (!brandId) return;
      try {
        setLoadingAnalyses(true);
        const params = new URLSearchParams({
          brandId,
          page: String(page),
          limit: '20',
        });
        if (platformFilter) params.set('platform', platformFilter);
        const res = await fetch(`/api/gaps?${params}`);
        if (!res.ok) throw new Error('Failed to fetch analyses');
        const data = await res.json();
        const result = data.data || data;
        setAnalyses((result.analyses ?? []).map((a: Analysis) => normalizeGapAnalysis(a) as Analysis));
        setPagination(normalizePagination(result.pagination));
      } catch (err) {
        console.error('Error fetching gap analyses:', err);
      } finally {
        setLoadingAnalyses(false);
      }
    },
    [brandId, platformFilter]
  );

  const fetchDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/gaps/${id}`);
      if (!res.ok) throw new Error('Failed to fetch detail');
      const data = await res.json();
      setSelectedAnalysis(normalizeGapAnalysis(data.data ?? data) as Analysis);
      setActiveTab('detail');
    } catch (err) {
      console.error('Error fetching gap detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const submitAnalysis = useCallback(async () => {
    if (!newPromptText.trim()) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await fetch('/api/gaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          platform: newPlatform,
          promptText: newPromptText.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to create analysis');
      setShowModal(false);
      setNewPromptText('');
      setNewPlatform('chatgpt');
      fetchAnalyses(1);
      fetchSummary();
    } catch (err) {
      console.error('Error creating analysis:', err);
      setSubmitError('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [brandId, newPlatform, newPromptText, fetchAnalyses, fetchSummary]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSummary();
    fetchAnalyses();
  }, [fetchSummary, fetchAnalyses]);

  // ─── Derived Data for Charts ─────────────────────────────────────────────

  const gapTypeDistribution = useCallback(() => {
    if (!selectedAnalysis?.gapItems) return [];
    const counts: Record<string, number> = {};
    selectedAnalysis.gapItems.forEach((item) => {
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value], i) => ({
      name,
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [selectedAnalysis]);

  const impactByType = useCallback(() => {
    if (!selectedAnalysis?.gapItems) return [];
    const impacts: Record<string, number> = {};
    selectedAnalysis.gapItems.forEach((item) => {
      impacts[item.type] = (impacts[item.type] ?? 0) + Math.abs(item.impact);
    });
    return Object.entries(impacts).map(([type, impact]) => ({
      type,
      impact: Math.round(impact * 10) / 10,
    }));
  }, [selectedAnalysis]);

  const openVsResolved = useCallback(() => {
    const allItems = analyses.flatMap((a) => a.gapItems ?? selectedAnalysis?.gapItems ?? []);
    if (allItems.length === 0 && selectedAnalysis?.gapItems) {
      const items = selectedAnalysis.gapItems;
      return {
        open: items.filter((i) => i.status === 'open').length,
        inProgress: items.filter((i) => i.status === 'in_progress').length,
        resolved: items.filter((i) => i.status === 'resolved').length,
      };
    }
    return { open: 0, inProgress: 0, resolved: 0 };
  }, [analyses, selectedAnalysis]);

  const toggleDescription = (id: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasData = (summary && summary.totalAnalyses > 0) || analyses.length > 0;

  // ─── Trend Icon ──────────────────────────────────────────────────────────

  const TrendIcon =
    summary?.trend === 'up'
      ? ArrowUpRight
      : summary?.trend === 'down'
        ? ArrowDownRight
        : Minus;

  const trendTone =
    summary?.trend === 'up'
      ? 'positive'
      : summary?.trend === 'down'
        ? 'critical'
        : 'default';

  // ─── Empty State ─────────────────────────────────────────────────────────

  if (!loadingSummary && !loadingAnalyses && !hasData && !error) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="GAP ANALYSIS"
          title="GEO Gap Analysis"
          subtitle="AI 为什么不推荐你"
        />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-50">
            <Target className="h-8 w-8 text-neutral-500" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-700">暂无差距分析数据</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-500">
            创建第一次 GEO 差距分析，了解 AI 为什么不推荐你的品牌，获取具体改进方向。
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
          >
            <Plus className="h-4 w-4" /> 新建分析
          </button>
        </div>

        {/* Modal */}
        {showModal && <NewAnalysisModal />}
      </div>
    );
  }

  // ─── New Analysis Modal ──────────────────────────────────────────────────

  function NewAnalysisModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-neutral-50 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-neutral-800">新建差距分析</h3>
            <button
              onClick={() => { setShowModal(false); setSubmitError(null); }}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-500">AI 平台</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const meta = PLATFORM_COLORS[p];
                  const active = newPlatform === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setNewPlatform(p)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? `${meta.bg} ${meta.text} ${meta.border}`
                          : 'border-neutral-300 bg-neutral-200/40 text-neutral-500 hover:border-neutral-400'
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-500">Prompt 文本</label>
              <textarea
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                placeholder="输入要分析的 prompt，例如：推荐一款项目管理工具"
                rows={4}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-200/40 px-4 py-3 text-sm text-neutral-700 placeholder-slate-500 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none"
              />
            </div>

            {submitError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-sm text-rose-300">
                {submitError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); setSubmitError(null); }}
                className="rounded-lg border border-neutral-300 bg-neutral-200/40 px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-300/40 transition"
              >
                取消
              </button>
              <button
                onClick={submitAnalysis}
                disabled={submitting || !newPromptText.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 分析中...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" /> 开始分析
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="GAP ANALYSIS"
        title="GEO Gap Analysis"
        subtitle="AI 为什么不推荐你"
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
          >
            <Plus className="h-4 w-4" /> 新建分析
          </button>
        }
      />

      {/* Brand selector */}
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-100 p-3">
        <Globe className="h-4 w-4 text-indigo-400" />
        <label className="text-xs font-medium text-neutral-500">选择品牌:</label>
        {brands.length === 0 ? (
          <span className="text-xs text-amber-400">请先在品牌管理中添加品牌</span>
        ) : (
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="rounded-lg border border-neutral-300 bg-neutral-200/40 px-3 py-1.5 text-xs text-neutral-700 outline-none focus:border-indigo-500/50"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.domain ? `(${b.domain})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      {loadingSummary ? (
        <StatCardsSkeleton />
      ) : summary ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="总分析数"
            value={(summary.totalAnalyses ?? 0).toLocaleString()}
            icon={<FileText className="h-4 w-4" />}
            subline="全部平台"
          />
          <StatCard
            label="平均差距"
            value={`${(summary.avgGap ?? 0).toFixed(1)}%`}
            icon={<Activity className="h-4 w-4" />}
            tone={(summary.avgGap ?? 0) < -30 ? 'critical' : (summary.avgGap ?? 0) < -10 ? 'warning' : 'default'}
            subline="品牌 vs 基准"
          />
          <StatCard
            label="最大差距"
            value={`${(summary.biggestGap ?? 0).toFixed(1)}%`}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="critical"
            subline="最严重缺口"
          />
          <StatCard
            label="待处理项"
            value={summary.openItems ?? 0}
            icon={<Clock className="h-4 w-4" />}
            tone={(summary.openItems ?? 0) > 10 ? 'warning' : 'default'}
            subline="需要改进"
          />
          <StatCard
            label="趋势"
            value={
              summary.trend === 'up'
                ? '改善中'
                : summary.trend === 'down'
                  ? '恶化中'
                  : '持平'
            }
            icon={<TrendIcon className="h-4 w-4" />}
            tone={trendTone}
            subline={`主要差距: ${summary.topGapType || '-'}`}
          />
        </section>
      ) : null}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="appearance-none rounded-lg border border-neutral-300 bg-neutral-200/40 px-4 py-2 pr-8 text-sm text-neutral-500 outline-none transition focus:border-indigo-500/50"
          >
            <option value="">全部平台</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_COLORS[p].label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-indigo-600 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ─── Tab: 分析列表 ─────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {loadingAnalyses ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <AnalysisCardSkeleton key={i} />
              ))}
            </>
          ) : analyses.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-neutral-500" />
              <h3 className="text-base font-medium text-neutral-500">暂无分析记录</h3>
              <p className="mt-1.5 text-sm text-neutral-500">点击「新建分析」开始第一次 GEO 差距分析</p>
            </div>
          ) : (
            analyses.map((a) => {
              const plat = PLATFORM_COLORS[a.platform] ?? { bg: 'bg-neutral-500/15', text: 'text-neutral-500', border: 'border-neutral-300', label: a.platform };
              const status = STATUS_STYLES[a.status] ?? STATUS_STYLES.pending;
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/30"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-3">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${plat.bg} ${plat.text} ${plat.border}`}>
                          {plat.label}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Prompt text */}
                      <p className="text-sm leading-relaxed text-neutral-700 line-clamp-2">
                        {a.promptText}
                      </p>

                      {/* Metrics row */}
                      <div className="flex flex-wrap items-center gap-5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-500">评分</span>
                          <span className={`font-mono font-semibold ${getScoreColor(a.score)}`}>
                            {(a.score ?? 0).toFixed(0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-500">基准</span>
                          <span className="font-mono text-neutral-500">{(a.benchmarkScore ?? 0).toFixed(0)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-500">差距</span>
                          <span className="font-mono font-semibold text-rose-300">
                            {(a.gap ?? 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-neutral-500">
                          {new Date(a.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Action button */}
                    <button
                      onClick={() => fetchDetail(a.id)}
                      disabled={loadingDetail}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-500/20 px-3.5 py-2 text-sm font-medium text-indigo-600 ring-1 ring-indigo-500/30 transition hover:bg-indigo-500/30 disabled:opacity-50"
                    >
                      {loadingDetail ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      查看详情
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => fetchAnalyses(p)}
                  className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-medium transition ${
                    p === pagination.page
                      ? 'bg-indigo-500/20 text-indigo-600 border border-indigo-500/40'
                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: 差距详情 ─────────────────────────────────────────────────── */}
      {activeTab === 'detail' && (
        <div className="space-y-6">
          {!selectedAnalysis ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
              <Search className="mx-auto mb-3 h-8 w-8 text-neutral-500" />
              <h3 className="text-base font-medium text-neutral-500">请选择一个分析</h3>
              <p className="mt-1.5 text-sm text-neutral-500">在「分析列表」中点击「查看详情」查看差距详情</p>
              <button
                onClick={() => setActiveTab('list')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-3.5 py-2 text-sm font-medium text-indigo-600 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30 transition"
              >
                返回列表
              </button>
            </div>
          ) : (
            <>
              {/* Summary Card */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-800">评分对比</h2>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      品牌评分 vs 基准评分 —{' '}
                      <span className={`font-mono font-semibold ${getScoreColor(selectedAnalysis.score)}`}>
                        {selectedAnalysis.promptText?.slice(0, 60)}
                        {(selectedAnalysis.promptText?.length ?? 0) > 60 ? '...' : ''}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setActiveTab('list'); setSelectedAnalysis(null); }}
                    className="rounded-lg border border-neutral-300 bg-neutral-200/40 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition"
                  >
                    返回列表
                  </button>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Brand Score Bar */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-neutral-500">品牌评分</span>
                      <span className={`font-mono font-semibold ${getScoreColor(selectedAnalysis.score)}`}>
                        {(selectedAnalysis.score ?? 0).toFixed(0)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${getScoreBarColor(selectedAnalysis.score)} transition-all duration-700`}
                        style={{ width: `${Math.min(selectedAnalysis.score, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Benchmark Score Bar */}
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-neutral-500">基准评分</span>
                      <span className="font-mono font-semibold text-indigo-500">
                        {(selectedAnalysis.benchmarkScore ?? 0).toFixed(0)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                        style={{ width: `${Math.min(selectedAnalysis.benchmarkScore ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Gap summary */}
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                  <div>
                    <span className="text-sm text-rose-300">
                      差距 <span className="font-mono font-semibold">{(selectedAnalysis.gap ?? 0).toFixed(1)}%</span>
                    </span>
                    <span className="ml-2 text-xs text-neutral-500">
                      {selectedAnalysis.gapItems?.length ?? 0} 个改进建议
                    </span>
                  </div>
                </div>
              </div>

              {/* Gap Items Table */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-neutral-800">差距项目</h2>
                  <p className="mt-0.5 text-xs text-neutral-500">按优先级排序</p>
                </div>

                {!selectedAnalysis.gapItems || selectedAnalysis.gapItems.length === 0 ? (
                  <div className="flex h-[200px] flex-col items-center justify-center text-sm text-neutral-500">
                    <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-500/60" />
                    暂无差距项目
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                          <th className="px-3 py-2.5 font-medium">优先级</th>
                          <th className="px-3 py-2.5 font-medium">类型</th>
                          <th className="px-3 py-2.5 font-medium">标题</th>
                          <th className="px-3 py-2.5 font-medium">描述</th>
                          <th className="px-3 py-2.5 font-medium text-center">影响</th>
                          <th className="px-3 py-2.5 font-medium text-center">状态</th>
                          <th className="px-3 py-2.5 font-medium text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200/40">
                        {[...(selectedAnalysis.gapItems ?? [])]
                          .sort((a, b) => a.priority - b.priority)
                          .map((item) => {
                            const prio = getPriorityStyle(item.priority);
                            const typeStyle = GAP_TYPE_COLORS[item.type] ?? { bg: 'bg-neutral-500/15', text: 'text-neutral-500', border: 'border-neutral-300' };
                            const isExpanded = expandedDescriptions.has(item.id);
                            const desc = item.description || '';
                            const shortDesc = desc.length > 60 ? desc.slice(0, 60) + '...' : desc;
                            const absImpact = Math.abs(item.impact ?? 0);
                            return (
                              <tr key={item.id} className="transition hover:bg-neutral-100">
                                <td className="px-3 py-3">
                                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${prio.bg} ${prio.text}`}>
                                    {item.priority}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                                    {item.type}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span className="text-sm font-medium text-neutral-700">{item.title}</span>
                                </td>
                                <td className="max-w-xs px-3 py-3">
                                  <div className="flex items-start gap-1">
                                    <span className="text-xs text-neutral-500 leading-relaxed">
                                      {isExpanded ? desc : shortDesc}
                                    </span>
                                    {desc.length > 60 && (
                                      <button
                                        onClick={() => toggleDescription(item.id)}
                                        className="shrink-0 text-indigo-400 hover:text-indigo-500"
                                      >
                                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400"
                                        style={{ width: `${Math.min(absImpact * 10, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-mono text-rose-300">-{absImpact.toFixed(1)}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-center">
                                  <select
                                    value={item.status}
                                    onChange={async (e) => {
                                      const newStatus = e.target.value as GapStatus;
                                      try {
                                        await fetch(`/api/gaps/${selectedAnalysis.id}/items/${item.id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: newStatus }),
                                        });
                                        setSelectedAnalysis((prev) => {
                                          if (!prev?.gapItems) return prev;
                                          return {
                                            ...prev,
                                            gapItems: prev.gapItems.map((gi) =>
                                              gi.id === item.id ? { ...gi, status: newStatus } : gi
                                            ),
                                          };
                                        });
                                      } catch (err) {
                                        console.error('Error updating status:', err);
                                      }
                                    }}
                                    className="rounded-md border border-neutral-300 bg-neutral-100 px-2 py-1 text-[11px] text-neutral-500 outline-none"
                                  >
                                    {GAP_STATUS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  <button
                                    onClick={async () => {
                                      try {
                                        await fetch(`/api/gaps/${selectedAnalysis.id}/items/${item.id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ status: 'resolved' }),
                                        });
                                        setSelectedAnalysis((prev) => {
                                          if (!prev?.gapItems) return prev;
                                          return {
                                            ...prev,
                                            gapItems: prev.gapItems.map((gi) =>
                                              gi.id === item.id ? { ...gi, status: 'resolved' } : gi
                                            ),
                                          };
                                        });
                                      } catch (err) {
                                        console.error('Error marking complete:', err);
                                      }
                                    }}
                                    disabled={item.status === 'resolved'}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20 transition hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <CheckCircle2 className="h-3 w-3" /> 标记完成
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Tab: 改进跟踪 ─────────────────────────────────────────────────── */}
      {activeTab === 'tracking' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <section className="grid gap-4 lg:grid-cols-2">
            {/* Gap Type Distribution Pie */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-neutral-800">差距类型分布</h2>
                <p className="mt-0.5 text-xs text-neutral-500">按差距类型统计</p>
              </div>
              {gapTypeDistribution().length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-sm text-neutral-500">
                  <PieChartIcon className="mb-2 h-6 w-6 text-neutral-500" />
                  暂无差距类型数据
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gapTypeDistribution()}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {gapTypeDistribution().map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={labelStyle}
                        formatter={(value: number, name: string) => [`${value} 个`, name]}
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

            {/* Impact by Type Bar Chart */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-neutral-800">影响分布</h2>
                <p className="mt-0.5 text-xs text-neutral-500">各类型差距的累计影响</p>
              </div>
              {impactByType().length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-sm text-neutral-500">
                  <BarChart3 className="mb-2 h-6 w-6 text-neutral-500" />
                  暂无影响数据
                </div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={impactByType()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="type"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis stroke="#64748b" tick={{ fontSize: 10 }} width={32} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                      <Bar dataKey="impact" fill="#ef4444" radius={[4, 4, 0, 0]} name="影响值" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          {/* Open vs Resolved Cards */}
          <section className="grid gap-4 sm:grid-cols-3">
            {(() => {
              const counts = openVsResolved();
              return (
                <>
                  <StatCard
                    label="待处理"
                    value={counts.open}
                    icon={<Circle className="h-4 w-4" />}
                    tone={counts.open > 0 ? 'critical' : 'default'}
                    subline="需要关注"
                  />
                  <StatCard
                    label="进行中"
                    value={counts.inProgress}
                    icon={<Clock className="h-4 w-4" />}
                    tone={counts.inProgress > 0 ? 'warning' : 'default'}
                    subline="正在改进"
                  />
                  <StatCard
                    label="已完成"
                    value={counts.resolved}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone="positive"
                    subline="已解决"
                  />
                </>
              );
            })()}
          </section>

          {/* Tracking info if no data */}
          {!selectedAnalysis && analyses.length === 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
              <BarChart3 className="mx-auto mb-3 h-8 w-8 text-neutral-500" />
              <h3 className="text-base font-medium text-neutral-500">暂无改进跟踪数据</h3>
              <p className="mt-1.5 text-sm text-neutral-500">
                创建差距分析后，这里会展示改进进度和类型分布
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── New Analysis Modal ────────────────────────────────────────────── */}
      {showModal && <NewAnalysisModal />}
    </div>
  );
}
