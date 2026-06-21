import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { cn, formatDate, pct } from '@/lib/utils';
import {
  ArrowLeft,
  ListChecks,
  Activity,
  TrendingUp,
  Sparkles,
  Globe,
  Play,
  Hash,
  History,
} from 'lucide-react';
import { PromptRow, GeneratePromptsButton, ScanNowButton, ScanHistoryClient } from './_components';

export const dynamic = 'force-dynamic';

const CATEGORY_LABEL: Record<string, string> = {
  recommend: '推荐',
  compare: '对比',
  review: '评测',
  tutorial: '教程',
  alternative: '替代',
  pricing: '价格',
  informational: '信息',
  commercial: '商业',
};

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;

  const brand = await prisma.brand.findFirst({
    where: { id: brandId, userId },
  });
  if (!brand) notFound();

  const [prompts, scanRuns, promptScanAgg] = await Promise.all([
    prisma.prompt.findMany({
      where: { brandId, userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.scanRun.findMany({
      where: { brandId, userId },
      orderBy: { startedAt: 'desc' },
      include: {
        promptScans: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { promptScans: true } },
      },
    }),
    prisma.promptScan.aggregate({
      where: { scanRun: { brandId, userId } },
      _avg: { brandRank: true },
      _count: { _all: true },
    }),
  ]);

  const [mentioned, total] = await Promise.all([
    prisma.promptScan.count({
      where: { scanRun: { brandId, userId }, brandMentioned: true },
    }),
    prisma.promptScan.count({ where: { scanRun: { brandId, userId } } }),
  ]);
  const citationRate = pct(mentioned, total);
  const avgRank = promptScanAgg._avg.brandRank;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={
          <Link
            href="/monitor"
            className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-3 w-3" /> 返回监控中心
          </Link>
        }
        title={brand.name}
        subtitle={brand.description ?? '管理该品牌的 Prompts、扫描与历史结果'}
        actions={
          <ScanNowButton brandId={brand.id} />
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        {brand.domain ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1">
            <Globe className="h-3 w-3" /> {brand.domain}
          </span>
        ) : null}
        {brand.category ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-50 px-2.5 py-1 text-indigo-600">
            <Hash className="h-3 w-3" /> {brand.category}
          </span>
        ) : null}
        {Array.isArray(brand.competitors) && brand.competitors.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-1">
            {brand.competitors.length} 个竞品
          </span>
        ) : null}
      </div>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Prompt 数"
          value={prompts.length}
          icon={<ListChecks className="h-4 w-4" />}
          subline={`${prompts.filter((p) => p.isActive).length} 启用中`}
        />
        <StatCard
          label="扫描次数"
          value={scanRuns.length}
          icon={<Activity className="h-4 w-4" />}
          subline={scanRuns[0] ? `最近 ${formatDate(scanRuns[0].startedAt)}` : '尚未启动'}
        />
        <StatCard
          label="引用率"
          value={`${citationRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={citationRate >= 30 ? 'positive' : 'default'}
          subline={`${mentioned} / ${total} 提及`}
        />
        <StatCard
          label="平均排名"
          value={avgRank ? `#${avgRank.toFixed(1)}` : '-'}
          icon={<Sparkles className="h-4 w-4" />}
          subline={total > 0 ? `${total} 次扫描结果` : '无数据'}
        />
      </section>

      {/* Prompts management */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">Prompts 管理</h2>
            <p className="mt-0.5 text-xs text-neutral-500">追踪 AI 在回答哪些问题时提及你的品牌</p>
          </div>
          <GeneratePromptsButton brandId={brand.id} />
        </div>

        {prompts.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="还没有 Prompt"
            description="点击「AI 生成 Prompts」让 极排 自动生成 50 个最可能被用户问到的问题。"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-2 font-medium">Prompt 文本</th>
                  <th className="px-2 py-2 font-medium">分类</th>
                  <th className="px-2 py-2 font-medium">状态</th>
                  <th className="px-2 py-2 font-medium">创建时间</th>
                  <th className="px-2 py-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/40">
                {prompts.map((p) => (
                  <PromptRow
                    key={p.id}
                    prompt={{
                      id: p.id,
                      text: p.text,
                      category: p.category,
                      isActive: p.isActive,
                      createdAt: p.createdAt.toISOString(),
                    }}
                    categoryLabel={CATEGORY_LABEL[p.category ?? ''] ?? p.category ?? '-'}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Scan history */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">扫描历史</h2>
            <p className="mt-0.5 text-xs text-neutral-500">点击展开查看每次扫描的 Prompt 结果</p>
          </div>
          <span className="text-xs text-neutral-500">共 {scanRuns.length} 次</span>
        </div>

        {scanRuns.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="还没有扫描记录"
            description="点击「立即扫描」开始第一次跨引擎扫描"
          />
        ) : (
          <ScanHistoryClient
            scans={scanRuns.map((s) => ({
              id: s.id,
              status: s.status,
              startedAt: s.startedAt.toISOString(),
              completedAt: s.completedAt?.toISOString() ?? null,
              completedPrompts: s.completedPrompts,
              totalPrompts: s.totalPrompts,
              platforms: Array.isArray(s.platforms) ? s.platforms : [],
              triggeredBy: s.triggeredBy,
              promptScans: s.promptScans.map((ps) => ({
                id: ps.id,
                platform: ps.platform,
                brandMentioned: ps.brandMentioned,
                brandRank: ps.brandRank,
                responseText: ps.responseText,
              })),
            }))}
          />
        )}
      </section>
    </div>
  );
}
