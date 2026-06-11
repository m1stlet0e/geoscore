import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Sparkles, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { prisma } from '@/lib/prisma';
import { getPlatformMeta } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PRIORITY_STYLES = {
  high: { ring: 'border-rose-500/40', bg: 'bg-rose-500/10', text: 'text-rose-200', label: '高' },
  medium: { ring: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-200', label: '中' },
  low: { ring: 'border-slate-500/40', bg: 'bg-slate-500/10', text: 'text-slate-200', label: '低' },
} as const;

export default async function GapsPage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;
  const { brandId } = await searchParams;

  const brands = await prisma.brand.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const activeBrand = brandId ? brands.find((b) => b.id === brandId) || brands[0] : brands[0];

  if (!activeBrand) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI 引用缺口分析" subtitle="竞品被 AI 引用、你没有出现 — 自动给出该发什么内容的清单" />
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
          <h3 className="mt-4 text-lg font-medium">还没有品牌</h3>
          <p className="mt-2 text-sm text-slate-400">先到「监控中心」创建一个品牌再开始分析缺口</p>
          <Link href="/monitor" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white">
            前往监控中心 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Aggregate gaps: from recent PromptScans where brand not mentioned, competitors present
  const recentScans = await prisma.scanRun.findMany({
    where: { brandId: activeBrand.id, status: 'completed' },
    orderBy: { completedAt: 'desc' },
    take: 5,
    include: {
      promptScans: {
        include: { prompt: true },
        take: 50,
      },
    },
  });

  const competitorSet = new Set(activeBrand.competitors.map((c) => c.toLowerCase()));
  const gapMap = new Map<string, { prompt: string; platform: string; competitors: Set<string>; occurrences: number }>();
  for (const scan of recentScans) {
    for (const ps of scan.promptScans) {
      if (ps.brandMentioned) continue;
      const text = (ps.responseText || '').toLowerCase();
      const found = new Set<string>();
      for (const c of activeBrand.competitors) {
        if (text.includes(c.toLowerCase())) found.add(c);
      }
      if (found.size === 0) continue;
      const key = `${ps.platform}::${ps.prompt.text}`;
      if (!gapMap.has(key)) gapMap.set(key, { prompt: ps.prompt.text, platform: ps.platform, competitors: found, occurrences: 0 });
      gapMap.get(key)!.occurrences++;
    }
  }
  const gaps = Array.from(gapMap.values())
    .sort((a, b) => b.competitors.size - a.competitors.size)
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 引用缺口分析"
        subtitle="竞品被 AI 引用、你没有出现 — 自动给出该发什么内容的清单,直接交给 Growth Agent"
      />

      {/* Brand selector */}
      <div className="flex flex-wrap items-center gap-2">
        {brands.map((b) => {
          const active = b.id === activeBrand.id;
          return (
            <Link
              key={b.id}
              href={`/gaps?brandId=${b.id}`}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition',
                active
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200'
                  : 'border-slate-800/60 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              )}
            >
              {b.name}
            </Link>
          );
        })}
      </div>

      {/* Hero metric */}
      <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-rose-500/10 via-slate-900/40 to-slate-900/40 p-6">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-semibold text-rose-200">{gaps.length}</span>
          <span className="text-sm text-slate-400">个引用缺口机会</span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          覆盖 <span className="text-slate-200">{competitorSet.size}</span> 个竞品,涉及
          <span className="text-slate-200"> {new Set(gaps.map((g) => g.platform)).size} </span>
          个 AI 平台
        </p>
      </div>

      {gaps.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-12 text-center">
          <div className="text-5xl">🎉</div>
          <h3 className="mt-4 text-lg font-medium text-emerald-200">暂未发现明显缺口</h3>
          <p className="mt-2 text-sm text-slate-400">你已经在所有竞品出现的 AI 回答里都有露出</p>
        </div>
      ) : (
        <div className="space-y-4">
          {gaps.map((g, i) => {
            const priority = g.competitors.size >= 3 ? 'high' : g.competitors.size >= 2 ? 'medium' : 'low';
            const ps = PRIORITY_STYLES[priority];
            const meta = getPlatformMeta(g.platform);
            return (
              <div key={i} className={cn('rounded-2xl border bg-slate-900/40 p-5', ps.ring)}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full border px-2 py-0.5 text-xs', ps.bg, ps.text, ps.ring)}>
                        优先级 {ps.label}
                      </span>
                      <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-xs" style={{ color: meta.color }}>
                        {meta.icon} {meta.name}
                      </span>
                      <span className="text-xs text-slate-500">出现 {g.occurrences} 次</span>
                    </div>
                    <h3 className="text-base font-medium text-slate-100">{g.prompt}</h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-500">竞品出现:</span>
                      {Array.from(g.competitors).map((c) => (
                        <span key={c} className="rounded-md bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300">{c}</span>
                      ))}
                      <span className="ml-2 text-xs text-rose-300">你没有出现</span>
                    </div>
                  </div>
                  <Link
                    href={`/growth?brandId=${activeBrand.id}&prompt=${encodeURIComponent(g.prompt)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-3 py-1.5 text-sm font-medium text-indigo-200 ring-1 ring-indigo-500/30 hover:bg-indigo-500/30"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> 生成内容
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
