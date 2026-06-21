'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { RadarVisualizer, type RadarDataPoint } from './RadarVisualizer';
import { UpgradeModal } from '@/app/(dashboard)/settings/_components/UpgradeModal';

const DIMENSION_LABELS: Record<string, string> = {
  github_activity: 'Gitee 活跃',
  zhihu_community: '知乎社区',
  wechat_content: '公众号覆盖',
  blog_authority: '技术博客',
  docs_quality: '文档质量',
  reddit_discussion: '社区讨论',
  media_coverage: '媒体报道',
  forum_discussion: '论坛讨论',
  social_mention: '社交提及',
  sspai_launch: 'Product Hunt',
  faq: 'FAQ 覆盖',
  comparison: '对比内容',
  use_case: '使用案例',
  schema: 'Schema 标记',
  media: '媒体曝光',
  github: 'Gitee',
  readme: '文档 README',
  blog: '博客文章',
  reddit: '知乎 讨论',
};

function mapFactorsToRadar(
  factors: Array<{
    factor?: string;
    label?: string;
    percentage?: number;
    avgWeight?: number;
  }>
): RadarDataPoint[] {
  return factors.slice(0, 8).map((f) => {
    const key = f.factor || f.label || 'unknown';
    const label = f.label || DIMENSION_LABELS[key] || key;
    const brandScore = Math.round(
      Math.min(100, Math.max(0, (f.avgWeight ?? f.percentage ?? 0) * (f.avgWeight ? 100 : 1)))
    );
    const benchmark = Math.min(100, brandScore + 18);
    return {
      subject: label.length > 12 ? `${label.slice(0, 11)}…` : label,
      A: brandScore,
      B: benchmark,
      fullMark: 100,
    };
  });
}

export function RadarInsightPanel({
  brandId,
  brandName,
}: {
  brandId?: string;
  brandName?: string;
}) {
  const [data, setData] = useState<RadarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [weakScore, setWeakScore] = useState(0);

  const load = useCallback(async () => {
    if (!brandId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/citations/factors?brandId=${brandId}`);
      const json = await res.json();
      const factors = json.data ?? [];
      const mapped = mapFactorsToRadar(factors);
      setData(mapped);
      if (mapped.length) {
        const avg = mapped.reduce((s, d) => s + d.A, 0) / mapped.length;
        setWeakScore(Math.round(avg));
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!brandId) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center text-sm text-neutral-500">
        请先创建品牌以查看 AI 维度雷达
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex h-[420px] items-center justify-center rounded-[2.5rem] border border-neutral-200 bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <RadarVisualizer
          data={data}
          brandName={brandName || '我的品牌'}
          competitorName="行业领先品牌"
        />
      )}

      {weakScore > 0 && weakScore < 65 && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold text-amber-900">
              AI 综合推荐指数仅 {weakScore}/100，落后于行业基准
            </p>
            <p className="mt-1 text-xs text-amber-800/80">
              升级 PRO 解锁每日深度扫描与无限 Gap 分析，快速补齐短板
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700"
          >
            <Zap className="h-4 w-4" />
            立即升级
          </button>
        </div>
      )}

      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
