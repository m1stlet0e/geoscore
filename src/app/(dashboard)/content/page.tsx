'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  FileText,
  Globe,
  Send,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  Eye,
  Trash2,
  Plus,
  X,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

// ─── Types ───────────────────────────────────────────────────────────────────

type Trend = 'up' | 'down' | 'stable';
type ContentStatus = 'draft' | 'review' | 'approved' | 'published' | 'archived';
type PublishStatus = 'pending' | 'in_progress' | 'published' | 'failed';
type Tone = 'professional' | 'casual' | 'technical' | 'marketing';
type Length = 'short' | 'medium' | 'long';
type PublishChannel = 'wordpress' | 'notion' | 'reddit' | 'github' | 'zhihu' | 'wechat';

interface ContentStats {
  totalPieces: number;
  publishedCount: number;
  draftCount: number;
  avgQuality: number;
  topType: string;
  recentTrend: Trend;
}

interface ContentItem {
  id: string;
  type: string;
  title: string;
  body: string;
  qualityScore: number;
  status: ContentStatus;
  createdAt: string;
  publishJobs?: PublishJob[];
}

interface PublishJob {
  id: string;
  channel: string;
  status: PublishStatus;
  externalUrl?: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type Tab = 'list' | 'publish';

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { key: 'FAQ', icon: '❓', label: 'FAQ', desc: '常见问题解答' },
  { key: 'COMPARISON', icon: '⚖️', label: '对比分析', desc: '产品/方案对比' },
  { key: 'USE_CASE', icon: '💡', label: '用例场景', desc: '实际应用案例' },
  { key: 'SCHEMA', icon: '🔧', label: 'Schema', desc: '结构化数据标记' },
  { key: 'BLOG_POST', icon: '📝', label: '博客文章', desc: 'SEO 博客内容' },
  { key: 'REDDIT_POST', icon: '📱', label: 'Reddit', desc: 'Reddit 帖子' },
  { key: 'GITHUB_README', icon: '🐙', label: 'GitHub', desc: 'GitHub README' },
  { key: 'ZHIHU_ANSWER', icon: '💬', label: '知乎回答', desc: '知乎问题回答' },
  { key: 'WECHAT_ARTICLE', icon: '📱', label: '微信公众号', desc: '公众号文章' },
  { key: 'MEDIA_PITCH', icon: '📰', label: '媒体稿件', desc: '新闻稿/PR' },
];

const STATUS_BADGES: Record<ContentStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-neutral-500/15 border-neutral-300', text: 'text-neutral-500', label: '草稿' },
  review: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-300', label: '审核中' },
  approved: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-300', label: '已批准' },
  published: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-300', label: '已发布' },
  archived: { bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-300', label: '已归档' },
};

const PUBLISH_STATUS_BADGES: Record<PublishStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-neutral-500/15 border-neutral-300', text: 'text-neutral-500', label: '待处理' },
  in_progress: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-300', label: '进行中' },
  published: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-300', label: '已发布' },
  failed: { bg: 'bg-rose-500/15 border-rose-500/30', text: 'text-rose-300', label: '失败' },
};

const PUBLISH_CHANNELS: { key: PublishChannel; label: string; icon: string }[] = [
  { key: 'wordpress', label: 'WordPress', icon: '🌐' },
  { key: 'notion', label: 'Notion', icon: '📓' },
  { key: 'reddit', label: 'Reddit', icon: '📱' },
  { key: 'github', label: 'GitHub', icon: '🐙' },
  { key: 'zhihu', label: '知乎', icon: '💬' },
  { key: 'wechat', label: '微信公众号', icon: '📱' },
];

const TABS: { key: Tab; label: string }[] = [
  { key: 'list', label: '内容列表' },
  { key: 'publish', label: '发布管理' },
];

function getTypeInfo(type: string) {
  return CONTENT_TYPES.find((t) => t.key === type) ?? { key: type, icon: '📄', label: type, desc: '' };
}

function getQualityColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

function getQualityTone(score: number): 'positive' | 'default' | 'warning' | 'critical' {
  if (score >= 80) return 'positive';
  if (score >= 60) return 'default';
  if (score >= 40) return 'warning';
  return 'critical';
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

function ContentCardsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-neutral-200 bg-white p-5"
        >
          <SkeletonPulse className="h-5 w-24 mb-3" />
          <SkeletonPulse className="h-4 w-3/4 mb-2" />
          <SkeletonPulse className="h-3 w-full mb-1" />
          <SkeletonPulse className="h-3 w-5/6 mb-4" />
          <SkeletonPulse className="h-2 w-full mb-3" />
          <div className="flex gap-2">
            <SkeletonPulse className="h-8 w-16" />
            <SkeletonPulse className="h-8 w-16" />
            <SkeletonPulse className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function ContentPage() {
  const [brandId, setBrandId] = useState<string>('');
  const [brands, setBrands] = useState<{ id: string; name: string; domain: string | null }[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('list');

  // Data states
  const [stats, setStats] = useState<ContentStats | null>(null);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [allPublishJobs, setAllPublishJobs] = useState<PublishJob[]>([]);

  // Loading states
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingContents, setLoadingContents] = useState(true);

  // Filter states
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [generating, setGenerating] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Generate form state
  const [genType, setGenType] = useState<string>('');
  const [genTopic, setGenTopic] = useState('');
  const [genKeyword, setGenKeyword] = useState('');
  const [genCompetitor, setGenCompetitor] = useState('');
  const [genTone, setGenTone] = useState<Tone>('professional');
  const [genLength, setGenLength] = useState<Length>('medium');

  // Detail modal edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [publishChannel, setPublishChannel] = useState<PublishChannel>('wordpress');
  const [publishingId, setPublishingId] = useState<string | null>(null);
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

  const fetchStats = useCallback(async () => {


      if (!brandId) return;
    try {
      setLoadingStats(true);
      const res = await fetch(`/api/content/stats?brandId=${brandId}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data.data ?? data);
    } catch (err) {
      console.error('Error fetching content stats:', err);
      setError('加载统计数据失败');
    } finally {
      setLoadingStats(false);
    }
  }, [brandId]);

  const fetchContents = useCallback(
    async (page = 1) => {
      if (!brandId) return;
      try {
        setLoadingContents(true);
        const params = new URLSearchParams({
          brandId,
          page: String(page),
          limit: '20',
        });
        if (filterType) params.set('type', filterType);
        if (filterStatus) params.set('status', filterStatus);
        if (searchQuery) params.set('search', searchQuery);
        const res = await fetch(`/api/content?${params}`);
        if (!res.ok) throw new Error('Failed to fetch contents');
        const data = await res.json();
        const result = data.data || data;
        setContents(result.contents ?? []);
        setPagination(result.pagination ?? null);
        // Collect all publish jobs from content items
        const jobs: PublishJob[] = [];
        (result.contents ?? []).forEach((c: ContentItem) => {
          if (c.publishJobs) jobs.push(...c.publishJobs);
        });
        setAllPublishJobs(jobs);
      } catch (err) {
        console.error('Error fetching contents:', err);
      } finally {
        setLoadingContents(false);
      }
    },
    [brandId, filterType, filterStatus, searchQuery]
  );

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!genType || !genTopic.trim()) return;
    try {
      setGenerating(true);
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          type: genType,
          topic: genTopic,
          targetKeyword: genKeyword || undefined,
          competitorName: genCompetitor || undefined,
          tone: genTone,
          length: genLength,
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      setShowGenerateModal(false);
      resetGenerateForm();
      fetchContents();
      fetchStats();
    } catch (err) {
      console.error('Error generating content:', err);
      setError('内容生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (contentId: string, status: ContentStatus) => {
    try {
      const res = await fetch(`/api/content/${contentId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Status update failed');
      fetchContents();
      fetchStats();
      if (selectedContent?.id === contentId) {
        setSelectedContent((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError('状态更新失败');
    }
  };

  const handlePublish = async (contentId: string, channel: PublishChannel) => {
    try {
      setPublishingId(contentId);
      const res = await fetch(`/api/content/${contentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) throw new Error('Publish failed');
      fetchContents();
    } catch (err) {
      console.error('Error publishing content:', err);
      setError('发布失败，请重试');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (contentId: string) => {
    try {
      const res = await fetch(`/api/content/${contentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      fetchContents();
      fetchStats();
    } catch (err) {
      console.error('Error deleting content:', err);
      setError('删除失败');
    }
  };

  const resetGenerateForm = () => {
    setGenType('');
    setGenTopic('');
    setGenKeyword('');
    setGenCompetitor('');
    setGenTone('professional');
    setGenLength('medium');
  };

  const openDetailModal = (content: ContentItem) => {
    setSelectedContent(content);
    setEditTitle(content.title);
    setEditBody(content.body);
    setEditing(false);
    setShowDetailModal(true);
  };

  // ─── Derived Data ────────────────────────────────────────────────────────

  const TrendIcon =
    stats?.recentTrend === 'up' ? TrendingUp : stats?.recentTrend === 'down' ? TrendingDown : Minus;

  const trendTone =
    stats?.recentTrend === 'up'
      ? 'positive'
      : stats?.recentTrend === 'down'
        ? 'critical'
        : 'default';

  const hasData = (stats && stats.totalPieces > 0) || contents.length > 0;

  // ─── Empty State ─────────────────────────────────────────────────────────

  if (!loadingStats && !loadingContents && !hasData && !error) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="GEO AGENT"
          title="GEO Agent"
          subtitle="AI 自动生成优化内容"
          actions={
            <button
              onClick={() => setShowGenerateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
            >
              <Plus className="h-4 w-4" /> 生成内容
            </button>
          }
        />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-300 bg-neutral-50">
            <Sparkles className="h-8 w-8 text-neutral-500" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-700">暂无生成内容</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-500">
            使用 GEO Agent 自动生成 FAQ、博客文章、对比分析等内容，提升品牌在 AI 平台中的可见性。
          </p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
          >
            <Sparkles className="h-4 w-4" /> 开始生成
          </button>
        </div>

        {showGenerateModal && (
          <GenerateModal
            genType={genType}
            setGenType={setGenType}
            genTopic={genTopic}
            setGenTopic={setGenTopic}
            genKeyword={genKeyword}
            setGenKeyword={setGenKeyword}
            genCompetitor={genCompetitor}
            setGenCompetitor={setGenCompetitor}
            genTone={genTone}
            setGenTone={setGenTone}
            genLength={genLength}
            setGenLength={setGenLength}
            generating={generating}
            onClose={() => { setShowGenerateModal(false); resetGenerateForm(); }}
            onSubmit={handleGenerate}
          />
        )}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="GEO AGENT"
        title="GEO Agent"
        subtitle="AI 自动生成优化内容"
        actions={
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
          >
            <Plus className="h-4 w-4" /> 生成内容
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
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      {loadingStats ? (
        <StatCardsSkeleton />
      ) : stats ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="总内容数"
            value={stats.totalPieces.toLocaleString()}
            icon={<FileText className="h-4 w-4" />}
            subline="全部类型"
          />
          <StatCard
            label="已发布"
            value={stats.publishedCount.toLocaleString()}
            icon={<Check className="h-4 w-4" />}
            tone="positive"
            subline="已上线内容"
          />
          <StatCard
            label="草稿"
            value={stats.draftCount.toLocaleString()}
            icon={<FileText className="h-4 w-4" />}
            subline="待处理"
          />
          <StatCard
            label="平均质量"
            value={stats.avgQuality.toFixed(1)}
            icon={<BarChart3 className="h-4 w-4" />}
            tone={getQualityTone(stats.avgQuality)}
            subline="满分 100"
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
            subline={stats.topType ? `热门: ${stats.topType}` : '近 30 天'}
          />
        </section>
      ) : null}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2">
          <Filter className="h-4 w-4 text-neutral-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-transparent text-sm text-neutral-500 outline-none"
          >
            <option value="">全部类型</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent text-sm text-neutral-500 outline-none"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="review">审核中</option>
            <option value="approved">已批准</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 min-w-[200px]">
          <Search className="h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="搜索内容..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-neutral-500 outline-none placeholder:text-neutral-500"
          />
        </div>
        <button
          onClick={() => fetchContents()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-200/40 px-3 py-2 text-sm text-neutral-500 transition hover:bg-neutral-300/40"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 刷新
        </button>
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

      {/* ─── Tab: Content List ───────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          {loadingContents ? (
            <ContentCardsSkeleton />
          ) : contents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-10 w-10 text-neutral-500 mb-4" />
              <p className="text-sm text-neutral-500">没有找到匹配的内容</p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-4 py-2 text-sm font-medium text-indigo-500 transition hover:bg-indigo-500/30"
              >
                <Plus className="h-4 w-4" /> 生成第一篇内容
              </button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {contents.map((item) => {
                const typeInfo = getTypeInfo(item.type);
                const statusBadge = STATUS_BADGES[item.status];
                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/40"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition group-hover:opacity-100" />

                    {/* Type badge & status */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
                        {typeInfo.icon} {typeInfo.label}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                      >
                        {statusBadge.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-neutral-800 mb-2 line-clamp-1">
                      {item.title}
                    </h3>

                    {/* Body preview */}
                    <p className="text-xs text-neutral-500 leading-relaxed mb-4 line-clamp-3">
                      {item.body.slice(0, 150)}
                      {item.body.length > 150 ? '...' : ''}
                    </p>

                    {/* Quality bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-neutral-500">质量评分</span>
                        <span className="text-xs font-medium text-neutral-500">{item.qualityScore}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-neutral-200">
                        <div
                          className={`h-full rounded-full transition-all ${getQualityColor(item.qualityScore)}`}
                          style={{ width: `${item.qualityScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Date & Actions */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-500">
                        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openDetailModal(item)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          <Eye className="h-3 w-3" /> 查看
                        </button>
                        <button
                          onClick={() => handlePublish(item.id, 'wordpress')}
                          disabled={publishingId === item.id}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-emerald-400 transition hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {publishingId === item.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}{' '}
                          发布
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-rose-400 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" /> 删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchContents(pagination.page - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-200/40 px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-300/40 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> 上一页
              </button>
              <span className="text-sm text-neutral-500">
                第 {pagination.page} / {pagination.totalPages} 页
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchContents(pagination.page + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-200/40 px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-300/40 disabled:opacity-40"
              >
                下一页 <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Publish Management ─────────────────────────────────────── */}
      {activeTab === 'publish' && (
        <div className="space-y-4">
          {loadingContents ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <SkeletonPulse className="h-4 w-8" />
                    <SkeletonPulse className="h-4 flex-1" />
                    <SkeletonPulse className="h-4 w-16" />
                    <SkeletonPulse className="h-4 w-16" />
                    <SkeletonPulse className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ) : allPublishJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Send className="h-10 w-10 text-neutral-500 mb-4" />
              <p className="text-sm text-neutral-500">暂无发布记录</p>
              <p className="mt-1 text-xs text-neutral-500">在内容列表中点击「发布」开始分发内容</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                      内容标题
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                      渠道
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                      状态
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                      外部链接
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                      日期
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/40">
                  {allPublishJobs.map((job) => {
                    const parentContent = contents.find((c) =>
                      c.publishJobs?.some((pj) => pj.id === job.id)
                    );
                    const pBadge = PUBLISH_STATUS_BADGES[job.status];
                    return (
                      <tr key={job.id} className="transition hover:bg-neutral-200/20">
                        <td className="px-5 py-3 text-neutral-700">
                          {parentContent?.title ?? '-'}
                        </td>
                        <td className="px-5 py-3 text-neutral-500 capitalize">
                          {job.channel}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${pBadge.bg} ${pBadge.text}`}
                          >
                            {pBadge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {job.externalUrl ? (
                            <a
                              href={job.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-500 transition"
                            >
                              查看链接 <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-neutral-500">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-neutral-500 text-xs">
                          {new Date(job.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Generate Content Modal ──────────────────────────────────────── */}
      {showGenerateModal && (
        <GenerateModal
          genType={genType}
          setGenType={setGenType}
          genTopic={genTopic}
          setGenTopic={setGenTopic}
          genKeyword={genKeyword}
          setGenKeyword={setGenKeyword}
          genCompetitor={genCompetitor}
          setGenCompetitor={setGenCompetitor}
          genTone={genTone}
          setGenTone={setGenTone}
          genLength={genLength}
          setGenLength={setGenLength}
          generating={generating}
          onClose={() => { setShowGenerateModal(false); resetGenerateForm(); }}
          onSubmit={handleGenerate}
        />
      )}

      {/* ─── Content Detail Modal ────────────────────────────────────────── */}
      {showDetailModal && selectedContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDetailModal(false)}
          />
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const typeInfo = getTypeInfo(selectedContent.type);
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                  );
                })()}
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[selectedContent.status].bg} ${STATUS_BADGES[selectedContent.status].text}`}
                >
                  {STATUS_BADGES[selectedContent.status].label}
                </span>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto max-h-[calc(85vh-180px)] p-6 space-y-6">
              {editing ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">标题</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1.5">正文</label>
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={12}
                      className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/60 resize-y"
                    />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-neutral-800">{selectedContent.title}</h2>
                  <div className="text-sm text-neutral-500 leading-relaxed whitespace-pre-wrap">
                    {selectedContent.body}
                  </div>
                </>
              )}

              {/* Quality */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-neutral-500">质量评分</span>
                  <span className="text-xs font-medium text-neutral-500">{selectedContent.qualityScore}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-200">
                  <div
                    className={`h-full rounded-full transition-all ${getQualityColor(selectedContent.qualityScore)}`}
                    style={{ width: `${selectedContent.qualityScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-neutral-200 px-6 py-4 space-y-3">
              {/* Status buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-neutral-500 mr-1">状态:</span>
                {(['draft', 'review', 'approved', 'published', 'archived'] as ContentStatus[]).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedContent.id, s)}
                      disabled={selectedContent.status === s}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        selectedContent.status === s
                          ? 'bg-indigo-500/20 text-indigo-500 border border-indigo-500/30'
                          : 'border border-neutral-300 text-neutral-500 hover:bg-neutral-200/40 hover:text-neutral-700'
                      }`}
                    >
                      {STATUS_BADGES[s].label}
                    </button>
                  )
                )}
              </div>

              {/* Edit & Publish row */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setEditing(!editing)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 transition hover:bg-neutral-200/40"
                >
                  {editing ? '取消编辑' : '编辑内容'}
                </button>

                <div className="flex items-center gap-2">
                  <select
                    value={publishChannel}
                    onChange={(e) => setPublishChannel(e.target.value as PublishChannel)}
                    className="rounded-lg border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-500 outline-none"
                  >
                    {PUBLISH_CHANNELS.map((ch) => (
                      <option key={ch.key} value={ch.key}>
                        {ch.icon} {ch.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handlePublish(selectedContent.id, publishChannel)}
                    disabled={publishingId === selectedContent.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50"
                  >
                    {publishingId === selectedContent.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}{' '}
                    发布
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Generate Modal Sub-Component ────────────────────────────────────────────

function GenerateModal({
  genType,
  setGenType,
  genTopic,
  setGenTopic,
  genKeyword,
  setGenKeyword,
  genCompetitor,
  setGenCompetitor,
  genTone,
  setGenTone,
  genLength,
  setGenLength,
  generating,
  onClose,
  onSubmit,
}: {
  genType: string;
  setGenType: (v: string) => void;
  genTopic: string;
  setGenTopic: (v: string) => void;
  genKeyword: string;
  setGenKeyword: (v: string) => void;
  genCompetitor: string;
  setGenCompetitor: (v: string) => void;
  genTone: Tone;
  setGenTone: (v: Tone) => void;
  genLength: Length;
  setGenLength: (v: Length) => void;
  generating: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-neutral-800">生成新内容</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">
          {/* Content Type Selector */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-3">内容类型</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setGenType(t.key)}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${
                    genType === t.key
                      ? 'border-indigo-500/60 bg-indigo-50'
                      : 'border-neutral-200 bg-neutral-100 hover:border-neutral-300'
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <div>
                    <div className="text-xs font-medium text-neutral-700">{t.label}</div>
                    <div className="text-[10px] text-neutral-500">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">主题</label>
            <textarea
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder="描述你想要生成的内容主题..."
              rows={3}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none placeholder:text-neutral-500 focus:border-indigo-500/60 resize-none"
            />
          </div>

          {/* Target keyword & competitor */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">目标关键词</label>
              <input
                type="text"
                value={genKeyword}
                onChange={(e) => setGenKeyword(e.target.value)}
                placeholder="e.g. AI 工具推荐"
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none placeholder:text-neutral-500 focus:border-indigo-500/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">
                竞品名称 <span className="text-neutral-500">(可选)</span>
              </label>
              <input
                type="text"
                value={genCompetitor}
                onChange={(e) => setGenCompetitor(e.target.value)}
                placeholder="e.g. CompetitorX"
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none placeholder:text-neutral-500 focus:border-indigo-500/60"
              />
            </div>
          </div>

          {/* Tone & Length */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">语气风格</label>
              <select
                value={genTone}
                onChange={(e) => setGenTone(e.target.value as Tone)}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/60"
              >
                <option value="professional">专业</option>
                <option value="casual">轻松</option>
                <option value="technical">技术</option>
                <option value="marketing">营销</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">内容长度</label>
              <select
                value={genLength}
                onChange={(e) => setGenLength(e.target.value as Length)}
                className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 outline-none focus:border-indigo-500/60"
              >
                <option value="short">短篇 (~300 字)</option>
                <option value="medium">中篇 (~800 字)</option>
                <option value="long">长篇 (~1500 字)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-500 transition hover:bg-neutral-200/40 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={generating || !genType || !genTopic.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> 生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> 开始生成
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
