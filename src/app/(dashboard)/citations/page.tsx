import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { getPlatformMeta } from '@/lib/constants';
import { cn, formatDate, pct } from '@/lib/utils';
import {
  Quote,
  Hash,
  Link2,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { CitationReasonChart } from './_chart';
import { BrandSelector } from './_brand-selector';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ brandId?: string }>;

// 5 reason categories with regex patterns (case-insensitive)
const REASON_DEFS = [
  { id: 'official', label: '官网', color: '#6366f1', patterns: [/\bofficial\b/i, /官网/, /官方网站/, /\.com\//i, /www\./] },
  { id: 'github', label: 'GitHub', color: '#10b981', patterns: [/github\.com/i, /github /i, /开源/] },
  { id: 'reddit', label: 'Reddit', color: '#f97316', patterns: [/reddit\.com/i, /\breddit\b/i, /r\//] },
  { id: 'media', label: '媒体', color: '#ec4899', patterns: [/techcrunch/i, /theverge/i, /wired/i, /forbes/i, /彭博/, /36kr/i, /虎嗅/i, /媒体/] },
  { id: 'blog', label: '博客', color: '#f59e0b', patterns: [/blog/i, /博客/, /medium\.com/i, /substack/i, /hashnode/i, /dev\.to/i] },
] as const;

export default async function CitationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;
  const sp = await searchParams;
  const brands = await prisma.brand.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, domain: true },
  });
  const selectedBrandId = sp.brandId && brands.some((b) => b.id === sp.brandId) ? sp.brandId : brands[0]?.id;

  if (!selectedBrandId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="MODULE 2"
          title="AI 答案引用分析"
          subtitle="深度解析品牌被 AI 引用的原因与来源"
        />
        <EmptyState
          icon={<Quote className="h-5 w-5" />}
          title="还没有品牌"
          description="先去监控中心添加品牌,然后完成一次扫描,这里会展示 AI 答案中的引用分析。"
          ctaLabel="前往监控中心"
          ctaHref="/monitor"
        />
      </div>
    );
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Fetch citations for the selected brand
  const [allCitations, topSources, recentCitations, agg] = await Promise.all([
    prisma.citation.findMany({
      where: { brandId: selectedBrandId, userId },
      select: { id: true, answerText: true, sources: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.citationSource.findMany({
      where: { brandId: selectedBrandId, userId },
      orderBy: { citationCount: 'desc' },
      take: 10,
    }),
    prisma.citation.findMany({
      where: { brandId: selectedBrandId, userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { brand: false },
    }),
    prisma.citation.aggregate({
      where: { brandId: selectedBrandId, userId },
      _avg: { brandRank: true },
    }),
  ]);

  // Growth (last 30 vs previous 30)
  const [recentCount, prevCount] = await Promise.all([
    prisma.citation.count({
      where: { brandId: selectedBrandId, userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.citation.count({
      where: {
        brandId: selectedBrandId,
        userId,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    }),
  ]);
  const growth = prevCount > 0 ? Math.round(((recentCount - prevCount) / prevCount) * 1000) / 10 : recentCount > 0 ? 100 : 0;

  // Independent source domains (dedup)
  const domainSet = new Set<string>();
  for (const c of allCitations) {
    const sources = Array.isArray(c.sources) ? (c.sources as Array<{ domain?: string }>) : [];
    for (const s of sources) {
      if (s.domain) domainSet.add(s.domain);
    }
  }
  // Also include from citationSource table
  for (const s of topSources) domainSet.add(s.domain);

  // Reason distribution (regex on answerText)
  const reasonCounts = new Map<string, number>();
  for (const def of REASON_DEFS) reasonCounts.set(def.id, 0);
  for (const c of allCitations) {
    const text = c.answerText ?? '';
    for (const def of REASON_DEFS) {
      if (def.patterns.some((p) => p.test(text))) {
        reasonCounts.set(def.id, (reasonCounts.get(def.id) ?? 0) + 1);
      }
    }
  }
  const reasonData = REASON_DEFS.map((def) => ({
    id: def.id,
    name: def.label,
    value: reasonCounts.get(def.id) ?? 0,
    color: def.color,
  })).filter((d) => d.value > 0);
  const hasReasons = reasonData.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="MODULE 2"
        title="AI 答案引用分析"
        subtitle="深度解析品牌被 AI 引用的原因、来源、来源域名分布,以及与竞品的话术对比。"
      />

      {/* Brand selector */}
      <BrandSelector
        brands={brands}
        selectedBrandId={selectedBrandId}
      />

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="总引用数"
          value={allCitations.length}
          icon={<Quote className="h-4 w-4" />}
          subline={`近 30 天 ${recentCount}`}
        />
        <StatCard
          label="独立来源"
          value={domainSet.size}
          icon={<Link2 className="h-4 w-4" />}
          subline="去重域名数"
        />
        <StatCard
          label="平均排名"
          value={agg._avg.brandRank ? `#${agg._avg.brandRank.toFixed(1)}` : '-'}
          icon={<Hash className="h-4 w-4" />}
          subline={agg._avg.brandRank ? 'brandRank 平均' : '无数据'}
        />
        <StatCard
          label="引用增长"
          value={growth > 0 ? `+${growth}%` : `${growth}%`}
          delta={growth}
          deltaLabel="vs 上 30 天"
          icon={<TrendingUp className="h-4 w-4" />}
          tone={growth > 0 ? 'positive' : growth < 0 ? 'critical' : 'default'}
        />
      </section>

      {/* Reason pie + Top sources */}
      <section className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5 lg:col-span-2">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-slate-100">引用原因分布</h2>
            <p className="mt-0.5 text-xs text-slate-400">AI 答案中提及品牌时涉及的来源类型</p>
          </div>
          {!hasReasons ? (
            <div className="flex h-[280px] flex-col items-center justify-center text-sm text-slate-500">
              <Quote className="mb-2 h-6 w-6 text-slate-600" />
              暂无引用原因数据
            </div>
          ) : (
            <CitationReasonChart data={reasonData} />
          )}
        </div>

        <div className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">Top 引用来源</h2>
            <span className="text-xs text-slate-500">按引用次数排序</span>
          </div>
          {topSources.length === 0 ? (
            <div className="flex h-[280px] flex-col items-center justify-center text-sm text-slate-500">
              <Link2 className="mb-2 h-6 w-6 text-slate-600" />
              暂无来源数据
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/40">
              {topSources.map((s, i) => {
                const max = topSources[0]?.citationCount ?? 1;
                const width = max > 0 ? (s.citationCount / max) * 100 : 0;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900/40 text-[10px] font-semibold text-slate-400">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{s.domain}</p>
                          {s.title ? (
                            <p className="truncate text-xs text-slate-500">{s.title}</p>
                          ) : null}
                        </div>
                        <span
                          className="shrink-0 rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-300"
                          style={{ borderColor: `${getPlatformMeta(s.platform).color}40` }}
                        >
                          {getPlatformMeta(s.platform).name}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-indigo-300">
                          {s.citationCount}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800/70">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Recent citations table */}
      <section className="rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">最近引用</h2>
          <span className="text-xs text-slate-500">最近 20 条</span>
        </div>
        {recentCitations.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">暂无引用记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/60 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-2 font-medium">平台</th>
                  <th className="px-2 py-2 font-medium">Prompt 摘要</th>
                  <th className="px-2 py-2 font-medium">排名</th>
                  <th className="px-2 py-2 font-medium">来源数</th>
                  <th className="px-2 py-2 font-medium">时间</th>
                  <th className="px-2 py-2 font-medium text-right">详情</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {recentCitations.map((c) => {
                  const pm = getPlatformMeta(c.platform);
                  const sources = Array.isArray(c.sources) ? (c.sources as unknown[]) : [];
                  return (
                    <tr key={c.id} className="transition hover:bg-slate-900/30">
                      <td className="px-2 py-3">
                        <span
                          className="inline-flex items-center rounded border border-slate-700/60 bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300"
                          style={{ borderColor: `${pm.color}50` }}
                        >
                          {pm.name}
                        </span>
                      </td>
                      <td className="max-w-md px-2 py-3">
                        <p className="line-clamp-1 text-sm text-slate-200">
                          {c.promptText.length > 80
                            ? c.promptText.slice(0, 80) + '…'
                            : c.promptText}
                        </p>
                      </td>
                      <td className="px-2 py-3 text-sm">
                        {c.brandRank ? (
                          <span className="font-mono text-indigo-300">#{c.brandRank}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-xs text-slate-400">{sources.length}</td>
                      <td className="px-2 py-3 text-xs text-slate-400">{formatDate(c.createdAt)}</td>
                      <td className="px-2 py-3 text-right">
                        <Link
                          href={`/citations/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
                        >
                          详情 <ExternalLink className="h-3 w-3" />
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
