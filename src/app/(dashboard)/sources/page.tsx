import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { AI_PLATFORMS } from '@/lib/constants';
import { cn, formatNumber } from '@/lib/utils';
import {
  Network,
  Globe,
  ArrowUpRight,
  Lightbulb,
  Github,
  MessageSquare,
  Star,
} from 'lucide-react';
import { BrandSelector } from '../citations/_brand-selector';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ brandId?: string }>;

// 5-step heat color scale
const HEAT_LEVELS = [
  'bg-neutral-200/40 text-neutral-500',
  'bg-neutral-200 text-neutral-500',
  'bg-indigo-500/30 text-indigo-100',
  'bg-indigo-500/55 text-white',
  'bg-indigo-400 text-slate-950',
];

function heatClass(value: number, max: number) {
  if (!max || value === 0) return HEAT_LEVELS[0];
  const ratio = value / max;
  if (ratio < 0.2) return HEAT_LEVELS[1];
  if (ratio < 0.4) return HEAT_LEVELS[2];
  if (ratio < 0.7) return HEAT_LEVELS[3];
  return HEAT_LEVELS[4];
}

export default async function SourcesPage({
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
          eyebrow="MODULE 3"
          title="AI 训练源追踪"
          subtitle="AI 到底从哪些网站学到推荐你"
        />
        <EmptyState
          icon={<Network className="h-5 w-5" />}
          title="还没有品牌"
          description="先去监控中心添加品牌,完成扫描后这里会展示权威引用源与平台分布矩阵。"
          ctaLabel="前往监控中心"
          ctaHref="/monitor"
        />
      </div>
    );
  }

  const [allSources, citationAgg] = await Promise.all([
    prisma.citationSource.findMany({
      where: { brandId: selectedBrandId, userId },
      orderBy: [{ weight: 'desc' }, { citationCount: 'desc' }],
      take: 200,
    }),
    prisma.citation.aggregate({
      where: { brandId: selectedBrandId, userId },
      _count: { _all: true },
    }),
  ]);

  // Top 15 domains by weight
  const topDomains = allSources.slice(0, 15);
  const maxWeight = topDomains.reduce((m, s) => Math.max(m, s.weight), 0);

  // Aggregate platforms covered
  const platformSet = new Set(allSources.map((s) => s.platform));

  // Platform × domain matrix
  const matrixDomains = Array.from(new Set(allSources.map((s) => s.domain))).slice(0, 12);
  const matrixCounts: Record<string, Record<string, number>> = {};
  for (const s of allSources) {
    if (!matrixCounts[s.platform]) matrixCounts[s.platform] = {};
    matrixCounts[s.platform][s.domain] = (matrixCounts[s.platform][s.domain] ?? 0) + s.citationCount;
  }
  const matrixMax = Math.max(1, ...allSources.map((s) => s.citationCount));

  // Suggested domain targets — derived from AI_PLATFORMS sources
  const suggestedTargets = [
    {
      domain: 'reddit.com',
      title: 'Reddit 社区运营',
      reason: 'AI 训练最高权重源之一。发 3-5 个相关 subreddit 帖子,1 个月内即可被 AI 引用。',
      icon: MessageSquare,
      priority: '高',
      color: 'border-rose-500/30 bg-rose-50 text-rose-600',
    },
    {
      domain: 'github.com',
      title: 'GitHub 技术生态',
      reason: '技术品牌必占阵地。开源核心模块,撰写清晰的 README,自然获得 AI 引用。',
      icon: Github,
      priority: '高',
      color: 'border-neutral-300 bg-neutral-300/30 text-neutral-700',
    },
    {
      domain: 'g2.com',
      title: 'G2 评测阵地',
      reason: 'B2B 品类最权威的评测源。主动邀请客户评价,显著提升对比类 prompt 引用率。',
      icon: Star,
      priority: '中',
      color: 'border-amber-500/30 bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="MODULE 3"
        title="AI 训练源追踪"
        subtitle="AI 到底从哪些网站学到推荐你 — 域名权重、平台分布、可抢占的运营阵地。"
      />

      <BrandSelector brands={brands} selectedBrandId={selectedBrandId} />

      {/* Hero metric */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-indigo-500/10 via-slate-900/80 to-violet-500/10 p-6">
        <div className="flex flex-col items-start gap-1">
          <p className="text-xs uppercase tracking-wider text-neutral-500">当前覆盖</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-4xl font-semibold tabular-nums text-neutral-900">
              {allSources.length}
            </span>
            <span className="text-sm text-neutral-500">个权威引用源</span>
            <span className="text-neutral-500">·</span>
            <span className="text-4xl font-semibold tabular-nums text-neutral-900">
              {platformSet.size}
            </span>
            <span className="text-sm text-neutral-500">个平台</span>
          </div>
          <p className="mt-3 text-sm text-neutral-500">
            覆盖 {AI_PLATFORMS.length} 大 AI 引擎中 {platformSet.size} 个,共被引用 {formatNumber(citationAgg._count._all)} 次。
          </p>
        </div>
      </section>

      {/* Top domains bar chart (pure CSS) */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">Top 引用域名</h2>
            <p className="mt-0.5 text-xs text-neutral-500">按 weight 排序(纯 CSS 条形图)</p>
          </div>
          <span className="text-xs text-neutral-500">共 {allSources.length} 个域名</span>
        </div>
        {topDomains.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500">暂无来源数据</div>
        ) : (
          <div className="space-y-2.5">
            {topDomains.map((s) => {
              const widthPct = maxWeight > 0 ? (s.weight / maxWeight) * 100 : 0;
              return (
                <div key={s.id} className="group flex items-center gap-3">
                  <div className="w-44 shrink-0 truncate text-right text-xs font-medium text-neutral-500">
                    {s.domain}
                  </div>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-neutral-200/40">
                    <div
                      className="absolute inset-y-0 left-0 flex items-center rounded-md bg-gradient-to-r from-indigo-500/70 to-violet-500/70 px-2 text-[10px] font-medium text-white transition-all group-hover:from-indigo-400 group-hover:to-violet-400"
                      style={{ width: `${Math.max(2, widthPct)}%` }}
                    >
                      {widthPct > 18 ? `weight ${s.weight.toFixed(2)}` : ''}
                    </div>
                  </div>
                  <div className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                    <span className="text-indigo-500">{s.citationCount}</span> 引用
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Platform × Domain matrix */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">平台 × 来源 矩阵</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              颜色越亮 = 该平台 AI 越依赖此域名回答问题
            </p>
          </div>
        </div>
        {matrixDomains.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500">暂无矩阵数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-medium text-neutral-500">
                    平台
                  </th>
                  {matrixDomains.map((d) => (
                    <th
                      key={d}
                      className="px-1.5 py-2 text-left font-medium text-neutral-500"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AI_PLATFORMS.map((p) => (
                  <tr key={p.id}>
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="text-xs text-neutral-700">{p.name}</span>
                      </div>
                    </td>
                    {matrixDomains.map((d) => {
                      const v = matrixCounts[p.id]?.[d] ?? 0;
                      return (
                        <td key={d} className="p-0.5">
                          <div
                            className={cn(
                              'flex h-7 min-w-[32px] items-center justify-center rounded text-[10px] tabular-nums',
                              heatClass(v, matrixMax)
                            )}
                            title={`${p.name} × ${d}: ${v}`}
                          >
                            {v > 0 ? v : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Suggested domain targets */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-300" />
          <h2 className="text-base font-semibold text-neutral-800">可抢占的运营阵地</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {suggestedTargets.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.domain}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/40 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.15)]"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 text-neutral-500">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', t.color)}>
                    优先级 {t.priority}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-neutral-800">{t.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">{t.reason}</p>
                <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3">
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-indigo-500">
                    <Globe className="h-3 w-3" /> {t.domain}
                  </span>
                  <Link
                    href={`https://${t.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 transition hover:text-indigo-500"
                  >
                    访问 <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
