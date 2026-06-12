'use client';

import { useState, useEffect, useCallback } from 'react';
import {
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
  Activity,
  Globe,
  Link2,
  Database,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Search,
  ExternalLink,
  X,
  Zap,
  Shield,
  Star,
  TrendingUp,
  MessageSquare,
  FileText,
  GitBranch,
  BookOpen,
  MessageCircle,
  Layers,
  BarChart3,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Stats {
  totalEvidence: number;
  avgConfidence: number;
  topPlatform: string;
  topFactor: string;
  domesticCount: number;
  internationalCount: number;
}

interface FactorDistribution {
  factor: string;
  label: string;
  count: number;
  totalWeight: number;
  avgWeight: number;
  percentage: number;
}

interface Evidence {
  id: string;
  platform: string;
  promptText: string;
  answerText?: string;
  sourceUrl?: string;
  sourceType?: string;
  recommendationReason?: string;
  confidence: number;
  weight: number;
  createdAt: string;
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
  recommendationReason?: string;
}

interface PlatformStats {
  platform: string;
  count: number;
}

interface PlatformData {
  domestic: string[];
  international: string[];
  stats: PlatformStats[];
}

type Tab = 'factors' | 'sources' | 'evidences';

// ─── Constants ───────────────────────────────────────────────────────────────

const DOMESTIC_PLATFORMS = [
  { key: 'all', label: '全部', emoji: '🌐' },
  { key: 'deepseek', label: 'DeepSeek', emoji: '🔮' },
  { key: 'kimi', label: 'Kimi', emoji: '🌙' },
  { key: 'doubao', label: '豆包', emoji: '🫘' },
  { key: 'yuanbao', label: '腾讯元宝', emoji: '💰' },
  { key: 'tongyi', label: '通义', emoji: '🤔' },
  { key: 'zhipu', label: '智谱', emoji: '📚' },
];

const INTERNATIONAL_PLATFORMS = [
  { key: 'chatgpt', label: 'ChatGPT', emoji: '🤖' },
  { key: 'claude', label: 'Claude', emoji: '🧠' },
  { key: 'gemini', label: 'Gemini', emoji: '✨' },
  { key: 'perplexity', label: 'Perplexity', emoji: '🔍' },
];

const PLATFORM_COLORS: Record<string, string> = {
  deepseek: '#6366f1',
  kimi: '#8b5cf6',
  doubao: '#a855f7',
  yuanbao: '#f59e0b',
  tongyi: '#ec4899',
  zhipu: '#14b8a6',
  chatgpt: '#22c55e',
  claude: '#f97316',
  gemini: '#3b82f6',
  perplexity: '#ef4444',
};

const SOURCE_TYPE_BADGE: Record<string, { bg: string; border: string; text: string }> = {
  github: { bg: 'bg-gray-500/15', border: 'border-gray-500/30', text: 'text-gray-300' },
  zhihu: { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-300' },
  wechat: { bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-300' },
  blog: { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-300' },
  docs: { bg: 'bg-indigo-50', border: 'border-indigo-500/30', text: 'text-indigo-500' },
  forum: { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-300' },
};

const FACTOR_ICONS: Record<string, React.ReactNode> = {
  authority: <Shield className="h-5 w-5" />,
  relevance: <Search className="h-5 w-5" />,
  freshness: <Zap className="h-5 w-5" />,
  trust: <Star className="h-5 w-5" />,
  popularity: <TrendingUp className="h-5 w-5" />,
  citation: <Link2 className="h-5 w-5" />,
  quality: <FileText className="h-5 w-5" />,
  diversity: <Layers className="h-5 w-5" />,
  sentiment: <MessageSquare className="h-5 w-5" />,
  engagement: <MessageCircle className="h-5 w-5" />,
};

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  authority: '来源的权威性程度，包括域名权重、行业认可度和专业资质',
  relevance: '内容与查询意图的匹配程度，关键词密度和语义相关性',
  freshness: '内容的时效性，发布时间和更新频率',
  trust: '来源的可信度，引用质量和事实准确性',
  popularity: '内容的传播广度，社交媒体分享和用户互动数据',
  citation: '被其他权威来源引用的频率和质量',
  quality: '内容质量，包括写作水平、结构化程度和信息密度',
  diversity: '引用来源的多样性，覆盖不同类型和平台',
  sentiment: '内容的情感倾向，正面评价占比',
  engagement: '用户参与度，包括评论、点赞和分享',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'factors', label: '推荐因子' },
  { key: 'sources', label: '来源分析' },
  { key: 'evidences', label: '证据详情' },
];

const CHART_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#6366f1', '#8b5cf6'];

// ─── Skeleton Components ─────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} />;
}

function StatCardsSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
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

function EvidenceSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <SkeletonPulse className="h-5 w-16" />
            <SkeletonPulse className="h-4 flex-1" />
          </div>
          <SkeletonPulse className="h-3 w-full mb-2" />
          <SkeletonPulse className="h-3 w-3/4 mb-3" />
          <div className="flex gap-4">
            <SkeletonPulse className="h-3 w-20" />
            <SkeletonPulse className="h-3 w-24" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
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

// ─── Helper: Platform Badge ──────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] || '#64748b';
  const platformInfo = [...DOMESTIC_PLATFORMS, ...INTERNATIONAL_PLATFORMS].find(
    (p) => p.key === platform
  );
  const label = platformInfo ? `${platformInfo.emoji} ${platformInfo.label}` : platform;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      {label}
    </span>
  );
}

// ─── Helper: Source Type Badge ────────────────────────────────────────────────

function SourceTypeBadge({ type }: { type: string }) {
  const badge = SOURCE_TYPE_BADGE[type] || {
    bg: 'bg-neutral-500/15',
    border: 'border-neutral-300',
    text: 'text-neutral-300',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.border} ${badge.text}`}
    >
      {type}
    </span>
  );
}

// ─── Helper: Factor Icon ─────────────────────────────────────────────────────

function FactorIcon({ factor }: { factor: string }) {
  return FACTOR_ICONS[factor] || <BarChart3 className="h-5 w-5" />;
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function CitationsIntelligencePage() {
  const [brandId, setBrandId] = useState<string>('');
  const [brands, setBrands] = useState<{ id: string; name: string; domain: string | null }[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('factors');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const [expandedEvidences, setExpandedEvidences] = useState<Set<string>>(new Set());

  // Data states
  const [stats, setStats] = useState<Stats | null>(null);
  const [factors, setFactors] = useState<FactorDistribution[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [platformData, setPlatformData] = useState<PlatformData | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);

  // Loading states
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [loadingEvidences, setLoadingEvidences] = useState(true);
  const [loadingPlatforms, setLoadingPlatforms] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);

  // Error states
  const [error, setError] = useState<string | null>(null);

  // Analyze modal states
  const [analyzePlatform, setAnalyzePlatform] = useState('deepseek');
  const [analyzePrompt, setAnalyzePrompt] = useState('');
  const [analyzeAnswer, setAnalyzeAnswer] = useState('');
  const [analyzeSources, setAnalyzeSources] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

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

  const fetchStats = useCallback(async () => {


      if (!brandId) return;
    try {
      setLoadingStats(true);
      const res = await fetch(`/api/citations/stats?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data.data || data);
    } catch (err) {
      console.error('Error fetching citation stats:', err);
      setError('加载统计数据失败');
    } finally {
      setLoadingStats(false);
    }
  }, [brandId]);

  const fetchFactors = useCallback(async () => {


      if (!brandId) return;
    try {
      setLoadingFactors(true);
      const res = await fetch(`/api/citations/factors?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch factors');
      const data = await res.json();
      setFactors(data.data ?? data ?? []);
    } catch (err) {
      console.error('Error fetching factors:', err);
    } finally {
      setLoadingFactors(false);
    }
  }, [brandId]);

  const fetchEvidences = useCallback(
    async (page = 1) => {
      if (!brandId) return;
      try {
        setLoadingEvidences(true);
        const platformParam = selectedPlatform !== 'all' ? `&platform=${selectedPlatform}` : '';
        const res = await fetch(
          `/api/citations/evidences?brandId=${brandId}&page=${page}&limit=20${platformParam}`
        );
        if (!res.ok) throw new Error('Failed to fetch evidences');
        const data = await res.json();
        const result = data.data || data;
        setEvidences(result.evidences ?? []);
        setPagination(result.pagination ?? null);
      } catch (err) {
        console.error('Error fetching evidences:', err);
      } finally {
        setLoadingEvidences(false);
      }
    },
    [brandId, selectedPlatform]
  );

  const fetchPlatforms = useCallback(async () => {


      if (!brandId) return;
    try {
      setLoadingPlatforms(true);
      const res = await fetch(`/api/citations/platforms?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch platforms');
      const data = await res.json();
      setPlatformData(data.data ?? data);
    } catch (err) {
      console.error('Error fetching platforms:', err);
    } finally {
      setLoadingPlatforms(false);
    }
  }, [brandId]);

  const fetchSources = useCallback(async () => {


      if (!brandId) return;
    try {
      setLoadingSources(true);
      const res = await fetch(`/api/citations/sources?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch sources');
      const data = await res.json();
      const result = data.data || data;
      setSources(result.sources ?? []);
    } catch (err) {
      console.error('Error fetching sources:', err);
    } finally {
      setLoadingSources(false);
    }
  }, [brandId]);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
    fetchFactors();
    fetchPlatforms();
    fetchSources();
  }, [fetchStats, fetchFactors, fetchPlatforms, fetchSources]);

  useEffect(() => {
    fetchEvidences(1);
  }, [fetchEvidences]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const toggleFactorExpand = (factor: string) => {
    setExpandedFactors((prev) => {
      const next = new Set(prev);
      if (next.has(factor)) next.delete(factor);
      else next.add(factor);
      return next;
    });
  };

  const toggleEvidenceExpand = (id: string) => {
    setExpandedEvidences((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (!analyzePrompt.trim()) return;
    try {
      setAnalyzing(true);
      const res = await fetch('/api/citations/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          platform: analyzePlatform,
          prompt: analyzePrompt,
          answer: analyzeAnswer,
          sources: analyzeSources
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error('Analysis failed');
      setShowAnalyzeModal(false);
      setAnalyzePrompt('');
      setAnalyzeAnswer('');
      setAnalyzeSources('');
      // Refresh data
      fetchStats();
      fetchFactors();
      fetchEvidences(1);
      fetchSources();
      fetchPlatforms();
    } catch (err) {
      console.error('Error running analysis:', err);
      setError('分析失败，请重试');
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Derived Data ────────────────────────────────────────────────────────

  const factorChartData = factors.map((f) => ({
    label: f.label,
    percentage: f.percentage,
    count: f.count,
    factor: f.factor,
  }));

  const sourceTypeData = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + s.citationCount;
    return acc;
  }, {});
  const sourceTypePieData = Object.entries(sourceTypeData).map(([name, value], i) => ({
    name,
    value,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const hasData =
    (stats && stats.totalEvidence > 0) || factors.length > 0 || evidences.length > 0;

  // ─── Empty State ─────────────────────────────────────────────────────────

  if (!loadingStats && !loadingFactors && !hasData && !error) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="CITATION INTELLIGENCE 2.0"
          title="Citation Intelligence 2.0"
          subtitle="谁在影响 AI 推荐你的品牌 — 真正的推荐因子分析"
        />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-50">
            <Database className="h-8 w-8 text-neutral-500" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-700">暂无引用数据</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-500">
            完成至少一次 AI 扫描后，这里会展示品牌在 AI 平台中的引用情况、推荐因子分析和来源影响力。
          </p>
          <button
            onClick={() => setShowAnalyzeModal(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
          >
            <Sparkles className="h-4 w-4" /> 开始分析
          </button>
        </div>

        {/* Analyze Modal */}
        {showAnalyzeModal && <AnalyzeModal />}
      </div>
    );
  }

  // ─── Analyze Modal ───────────────────────────────────────────────────────

  function AnalyzeModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => !analyzing && setShowAnalyzeModal(false)}
        />
        <div className="relative w-full max-w-lg rounded-2xl border border-neutral-300 bg-neutral-50 p-6 shadow-2xl">
          <button
            onClick={() => !analyzing && setShowAnalyzeModal(false)}
            className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
          <h3 className="text-lg font-semibold text-neutral-800 mb-1">运行引用分析</h3>
          <p className="text-xs text-neutral-500 mb-5">输入 AI 平台的回答内容，分析推荐因子</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">平台</label>
              <select
                value={analyzePlatform}
                onChange={(e) => setAnalyzePlatform(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/50"
              >
                {[...DOMESTIC_PLATFORMS.filter((p) => p.key !== 'all'), ...INTERNATIONAL_PLATFORMS].map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.emoji} {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Prompt <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={analyzePrompt}
                onChange={(e) => setAnalyzePrompt(e.target.value)}
                placeholder="输入查询的 Prompt..."
                className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/50 placeholder:text-neutral-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                回答内容
              </label>
              <textarea
                value={analyzeAnswer}
                onChange={(e) => setAnalyzeAnswer(e.target.value)}
                placeholder="粘贴 AI 平台的回答内容..."
                rows={4}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/50 placeholder:text-neutral-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                引用来源 <span className="text-neutral-500">(每行一个 URL)</span>
              </label>
              <textarea
                value={analyzeSources}
                onChange={(e) => setAnalyzeSources(e.target.value)}
                placeholder="https://example.com/article&#10;https://github.com/repo"
                rows={3}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/50 placeholder:text-neutral-500 resize-none"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => setShowAnalyzeModal(false)}
              disabled={analyzing}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-100 transition disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !analyzePrompt.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  <Activity className="h-4 w-4 animate-spin" /> 分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> 开始分析
                </>
              )}
            </button>
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
        eyebrow="CITATION INTELLIGENCE 2.0"
        title="Citation Intelligence 2.0"
        subtitle="谁在影响 AI 推荐你的品牌 — 真正的推荐因子分析"
      />

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

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

      {/* Stat Cards */}
      {loadingStats ? (
        <StatCardsSkeleton />
      ) : stats ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard
            label="总证据数"
            value={stats.totalEvidence.toLocaleString()}
            icon={<Database className="h-4 w-4" />}
            subline="全部平台"
          />
          <StatCard
            label="平均置信度"
            value={`${stats.avgConfidence.toFixed(1)}%`}
            icon={<Activity className="h-4 w-4" />}
            tone={
              stats.avgConfidence >= 70
                ? 'positive'
                : stats.avgConfidence >= 40
                  ? 'default'
                  : 'warning'
            }
            subline="置信度指标"
          />
          <StatCard
            label="主要平台"
            value={stats.topPlatform || '-'}
            icon={<Globe className="h-4 w-4" />}
            subline="最高引用平台"
          />
          <StatCard
            label="核心因子"
            value={stats.topFactor || '-'}
            icon={<Zap className="h-4 w-4" />}
            subline="最强推荐因子"
          />
          <StatCard
            label="国内平台"
            value={stats.domesticCount.toLocaleString()}
            icon={<Globe className="h-4 w-4" />}
            tone="positive"
            subline="国内 AI 平台"
          />
          <StatCard
            label="国际平台"
            value={stats.internationalCount.toLocaleString()}
            icon={<Globe className="h-4 w-4" />}
            subline="国际 AI 平台"
          />
        </section>
      ) : null}

      {/* Platform Selector */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">选择平台</h3>

        {/* Domestic */}
        <div className="mb-3">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2 block">
            国内平台
          </span>
          <div className="flex flex-wrap gap-2">
            {DOMESTIC_PLATFORMS.map((p) => {
              const isActive = selectedPlatform === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setSelectedPlatform(p.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-600 shadow-sm shadow-indigo-500/10'
                      : 'border-neutral-300 bg-neutral-200/40 text-neutral-500 hover:border-neutral-400/60 hover:text-neutral-300'
                  }`}
                >
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* International */}
        <div>
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2 block">
            国际平台
          </span>
          <div className="flex flex-wrap gap-2">
            {INTERNATIONAL_PLATFORMS.map((p) => {
              const isActive = selectedPlatform === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setSelectedPlatform(p.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-600 shadow-sm shadow-indigo-500/10'
                      : 'border-neutral-300 bg-neutral-200/40 text-neutral-500 hover:border-neutral-400/60 hover:text-neutral-300'
                  }`}
                >
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

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

      {/* ─── Tab: 推荐因子 ──────────────────────────────────────────────── */}
      {activeTab === 'factors' && (
        <div className="space-y-6">
          {/* Factor Distribution Chart */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-neutral-800">推荐因子分布</h2>
              <p className="mt-0.5 text-xs text-neutral-500">各推荐因子的影响占比</p>
            </div>
            {loadingFactors ? (
              <ChartSkeleton />
            ) : factorChartData.length === 0 ? (
              <div className="flex h-[320px] flex-col items-center justify-center text-sm text-neutral-500">
                <BarChart3 className="mb-2 h-6 w-6 text-neutral-500" />
                暂无因子数据
              </div>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={factorChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="factorGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#64748b"
                      tick={{ fontSize: 10 }}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      stroke="#64748b"
                      tick={{ fontSize: 11, fill: '#cbd5e1' }}
                      width={72}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={labelStyle}
                      formatter={(value: number, _name: string, props: { payload?: { count?: number } }) => [
                        `${value.toFixed(1)}% (${props.payload?.count ?? 0} 次)`,
                        '占比',
                      ]}
                    />
                    <Bar
                      dataKey="percentage"
                      fill="url(#factorGradient)"
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                      label={{
                        position: 'right',
                        fill: '#94a3b8',
                        fontSize: 11,
                        formatter: (v: number) => `${v.toFixed(1)}%`,
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Factor Explanation Cards */}
          <section>
            <h2 className="text-base font-semibold text-neutral-800 mb-4">因子详细分析</h2>
            {loadingFactors ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-neutral-200 bg-neutral-100 p-5"
                  >
                    <SkeletonPulse className="h-5 w-24 mb-3" />
                    <SkeletonPulse className="h-3 w-full mb-2" />
                    <SkeletonPulse className="h-8 w-full mb-3" />
                    <SkeletonPulse className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : factors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-100 p-12 text-center">
                <Zap className="mx-auto mb-3 h-8 w-8 text-neutral-500" />
                <p className="text-sm text-neutral-500">暂无因子数据</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {factors.slice(0, 6).map((f) => {
                  const isExpanded = expandedFactors.has(f.factor);
                  return (
                    <div
                      key={f.factor}
                      className="group rounded-xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/30"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-50 text-indigo-500">
                          <FactorIcon factor={f.factor} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-800">{f.label}</h3>
                          <span className="text-[11px] text-neutral-500">{f.factor}</span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-neutral-500">影响占比</span>
                          <span className="text-xs font-semibold text-indigo-500">
                            {f.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(f.percentage, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-neutral-500 mb-3">
                        <span>出现 {f.count} 次</span>
                        <span>平均权重 {f.avgWeight.toFixed(2)}</span>
                      </div>

                      <p className="text-xs leading-relaxed text-neutral-500 mb-2">
                        {FACTOR_DESCRIPTIONS[f.factor] || '推荐因子对 AI 推荐结果有重要影响'}
                      </p>

                      <button
                        onClick={() => toggleFactorExpand(f.factor)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-500 transition"
                      >
                        影响说明
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-200/30 p-3 text-xs leading-relaxed text-neutral-500">
                          <p>
                            <strong className="text-neutral-300">{f.label}</strong> 因子在分析中出现了{' '}
                            <strong className="text-neutral-300">{f.count}</strong> 次，占总权重的{' '}
                            <strong className="text-indigo-500">{f.percentage.toFixed(1)}%</strong>
                            。平均权重为 {f.avgWeight.toFixed(2)}。
                          </p>
                          <p className="mt-2">
                            优化建议：通过提升 {f.label} 相关指标，可以有效提高品牌在 AI 推荐中的排名。
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ─── Tab: 来源分析 ──────────────────────────────────────────────── */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-5">
            {/* Source Type Pie Chart */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-2">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-neutral-800">来源类型分布</h2>
                <p className="mt-0.5 text-xs text-neutral-500">按引用次数统计</p>
              </div>
              {loadingSources ? (
                <ChartSkeleton height="h-[280px]" />
              ) : sourceTypePieData.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-sm text-neutral-500">
                  <Link2 className="mb-2 h-6 w-6 text-neutral-500" />
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

            {/* Source Rankings Table */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-neutral-800">来源排名</h2>
                <span className="text-xs text-neutral-500">按影响力排序</span>
              </div>
              {loadingSources ? (
                <TableSkeleton rows={8} />
              ) : sources.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center text-sm text-neutral-500">
                  <Link2 className="mb-2 h-6 w-6 text-neutral-500" />
                  暂无来源数据
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                        <th className="px-3 py-2.5 font-medium">#</th>
                        <th className="px-3 py-2.5 font-medium">域名</th>
                        <th className="px-3 py-2.5 font-medium">类型</th>
                        <th className="px-3 py-2.5 font-medium text-center">权重</th>
                        <th className="px-3 py-2.5 font-medium text-center">引用次数</th>
                        <th className="px-3 py-2.5 font-medium text-center">影响力</th>
                        <th className="px-3 py-2.5 font-medium">推荐原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/40">
                      {sources.map((s, i) => {
                        const maxInfluence = sources[0]?.influenceScore ?? 1;
                        const width =
                          maxInfluence > 0 ? (s.influenceScore / maxInfluence) * 100 : 0;
                        return (
                          <tr key={s.id} className="transition hover:bg-neutral-100">
                            <td className="px-3 py-3">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-[10px] font-semibold text-neutral-500">
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-sm font-medium text-neutral-800">
                                {s.domain}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <SourceTypeBadge type={s.type} />
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-xs text-neutral-300">
                              {s.weight.toFixed(1)}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-xs text-indigo-500">
                              {s.citationCount}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                                  <div
                                    className="h-full rounded-full bg-indigo-500"
                                    style={{ width: `${width}%` }}
                                  />
                                </div>
                                <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                                  {s.influenceScore.toFixed(1)}
                                </span>
                              </div>
                            </td>
                            <td className="max-w-[200px] px-3 py-3">
                              <p className="line-clamp-1 text-xs text-neutral-500">
                                {s.recommendationReason || '-'}
                              </p>
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

      {/* ─── Tab: 证据详情 ──────────────────────────────────────────────── */}
      {activeTab === 'evidences' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-neutral-800">证据详情</h2>
                <p className="mt-0.5 text-xs text-neutral-500">AI 推荐的具体证据记录</p>
              </div>
              {pagination && (
                <span className="text-xs text-neutral-500">共 {pagination.total} 条</span>
              )}
            </div>

            {loadingEvidences ? (
              <EvidenceSkeleton />
            ) : evidences.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center text-sm text-neutral-500">
                <Database className="mb-2 h-6 w-6 text-neutral-500" />
                暂无证据记录
              </div>
            ) : (
              <div className="space-y-3">
                {evidences.map((ev) => {
                  const isExpanded = expandedEvidences.has(ev.id);
                  const confidenceTone =
                    ev.confidence >= 0.7
                      ? 'from-emerald-500 to-green-500'
                      : ev.confidence >= 0.4
                        ? 'from-amber-500 to-yellow-500'
                        : 'from-rose-500 to-red-500';

                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-neutral-200 bg-neutral-100 p-4 transition hover:border-neutral-300"
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlatformBadge platform={ev.platform} />
                          {ev.sourceType && <SourceTypeBadge type={ev.sourceType} />}
                        </div>
                        <span className="text-[11px] text-neutral-500 shrink-0">
                          {new Date(ev.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      {/* Prompt */}
                      <p className="text-sm text-neutral-700 mb-2 line-clamp-2">
                        {ev.promptText}
                      </p>

                      {/* Source URL */}
                      {ev.sourceUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-500 transition mb-3"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {ev.sourceUrl.length > 60
                            ? ev.sourceUrl.slice(0, 60) + '...'
                            : ev.sourceUrl}
                        </a>
                      )}

                      {/* Metrics row */}
                      <div className="flex items-center gap-4 flex-wrap">
                        {/* Confidence */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500">置信度</span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${confidenceTone}`}
                              style={{ width: `${ev.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-neutral-500">
                            {(ev.confidence * 100).toFixed(0)}%
                          </span>
                        </div>

                        {/* Weight */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-neutral-500">权重</span>
                          <span className="text-[11px] font-mono text-indigo-500">
                            {ev.weight.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Recommendation reason preview */}
                      {ev.recommendationReason && (
                        <p className="mt-2 text-xs text-neutral-500 line-clamp-1">
                          💡 {ev.recommendationReason}
                        </p>
                      )}

                      {/* Expandable */}
                      <button
                        onClick={() => toggleEvidenceExpand(ev.id)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-500 transition"
                      >
                        {isExpanded ? '收起详情' : '展开详情'}
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-200/30 p-3 space-y-2">
                          {ev.answerText && (
                            <div>
                              <span className="text-[11px] font-medium text-neutral-500">
                                回答内容
                              </span>
                              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                                {ev.answerText}
                              </p>
                            </div>
                          )}
                          {ev.recommendationReason && (
                            <div>
                              <span className="text-[11px] font-medium text-neutral-500">
                                推荐原因
                              </span>
                              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                                {ev.recommendationReason}
                              </p>
                            </div>
                          )}
                          <div className="flex gap-4 text-[11px] text-neutral-500">
                            <span>置信度: {(ev.confidence * 100).toFixed(1)}%</span>
                            <span>权重: {ev.weight.toFixed(3)}</span>
                            <span>
                              创建时间:{' '}
                              {new Date(ev.createdAt).toLocaleString('zh-CN')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => fetchEvidences(Math.max(1, pagination.page - 1))}
                  disabled={pagination.page <= 1}
                  className="h-8 rounded-lg border border-neutral-300 px-3 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/40 transition disabled:opacity-40"
                >
                  上一页
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    const current = pagination.page;
                    return p === 1 || p === pagination.totalPages || Math.abs(p - current) <= 2;
                  })
                  .map((p, idx, arr) => {
                    const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-neutral-500 text-xs">...</span>}
                        <button
                          onClick={() => fetchEvidences(p)}
                          className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-medium transition ${
                            p === pagination.page
                              ? 'bg-indigo-500/20 text-indigo-600 border border-indigo-500/40'
                              : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/40'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}
                <button
                  onClick={() =>
                    fetchEvidences(Math.min(pagination.totalPages, pagination.page + 1))
                  }
                  disabled={pagination.page >= pagination.totalPages}
                  className="h-8 rounded-lg border border-neutral-300 px-3 text-xs text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/40 transition disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Floating Analyze Button */}
      <button
        onClick={() => setShowAnalyzeModal(true)}
        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition hover:scale-105 hover:shadow-indigo-500/50"
        title="运行引用分析"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Analyze Modal */}
      {showAnalyzeModal && <AnalyzeModal />}
    </div>
  );
}
