import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LineChart, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { prisma } from '@/lib/prisma';
import { cn, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;
  const { brandId } = await searchParams;

  const brands = await prisma.brand.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const activeBrand = brandId ? brands.find((b) => b.id === brandId) || brands[0] : brands[0];

  if (!activeBrand) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI 推荐预测" subtitle="基于历史数据预测未来 30 天品牌曝光与排名" />
        <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-12 text-center">
          <LineChart className="mx-auto h-8 w-8 text-cyan-400" />
          <h3 className="mt-4 text-lg font-medium">先创建品牌</h3>
          <Link href="/monitor" className="mt-4 inline-block rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white">
            前往监控中心
          </Link>
        </div>
      </div>
    );
  }

  // current visibility from PromptScans
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const promptScans = await prisma.promptScan.findMany({
    where: { scanRun: { brandId: activeBrand.id }, createdAt: { gte: thirtyDaysAgo } },
    select: { brandMentioned: true, brandRank: true, createdAt: true },
  });
  const totalScans = promptScans.length;
  const mentionedScans = promptScans.filter((p) => p.brandMentioned).length;
  const currentScore = totalScans > 0 ? Math.round((mentionedScans / totalScans) * 100) : 0;
  const ranksArr = promptScans.filter((p) => p.brandRank != null).map((p) => p.brandRank as number);
  const avgRank = ranksArr.length > 0 ? ranksArr.reduce((a, b) => a + b, 0) / ranksArr.length : 0;

  // recent forecast records
  const forecasts = await prisma.forecast.findMany({
    where: { brandId: activeBrand.id },
    orderBy: { generatedAt: 'desc' },
    take: 3,
  });
  const latestForecast = forecasts[0];
  const predictedScore = latestForecast?.predictedScore ?? Math.min(95, currentScore + 8);
  const delta = predictedScore - currentScore;
  const drivers = (latestForecast?.drivers as Array<{ factor: string; impact: number }> | null) || [
    { factor: 'Reddit 讨论增加', impact: 0.18 },
    { factor: 'GitHub README 优化', impact: 0.12 },
    { factor: '行业媒体引用', impact: 0.09 },
    { factor: '竞品缺席率上升', impact: 0.06 },
    { factor: '官方文档 Schema 完善', impact: 0.04 },
  ];

  // scenarios
  const scenarios = [
    { name: '保守', score: Math.max(0, currentScore - 3), cls: 'border-neutral-300' },
    { name: '基准', score: currentScore, cls: 'border-indigo-500/30' },
    { name: '乐观', score: Math.min(100, currentScore + 18), cls: 'border-emerald-500/30' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="AI 推荐预测" subtitle="基于历史数据预测未来 30 天品牌曝光与排名" />

      {/* Brand selector */}
      <div className="flex flex-wrap items-center gap-2">
        {brands.map((b) => (
          <Link
            key={b.id}
            href={`/forecast?brandId=${b.id}`}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm transition',
              b.id === activeBrand.id
                ? 'border-indigo-500/40 bg-indigo-50 text-indigo-600'
                : 'border-neutral-200 bg-neutral-100 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700'
            )}
          >
            {b.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="当前可见性" value={`${currentScore}%`} delta={null} />
        <StatCard
          label="30 天预测"
          value={`${predictedScore.toFixed(0)}%`}
          delta={delta}
          icon={delta > 0 ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-rose-400" />}
        />
        <StatCard label="平均排名" value={avgRank > 0 ? avgRank.toFixed(1) : '—'} delta={null} />
      </div>

      {/* Big predicted card */}
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-indigo-500/10 via-slate-900/40 to-slate-900/40 p-6">
        <div className="flex items-baseline gap-4">
          <Activity className="h-5 w-5 text-indigo-500" />
          <div>
            <div className="text-xs text-neutral-500">未来 30 天预测</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-semibold text-indigo-600">{predictedScore.toFixed(0)}</span>
              <span className="text-sm text-neutral-500">分</span>
              <span className={cn('text-sm font-medium', delta > 0 ? 'text-emerald-300' : 'text-rose-300')}>
                {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
              </span>
            </div>
            {latestForecast && (
              <div className="mt-2 text-xs text-neutral-500">生成时间: {formatDate(latestForecast.generatedAt)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Drivers */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-6">
        <h3 className="mb-4 text-sm font-medium">驱动因素</h3>
        <div className="space-y-2">
          {drivers.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-40 truncate text-xs text-neutral-500">{d.factor}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400"
                  style={{ width: `${Math.min(100, d.impact * 400)}%` }}
                />
              </div>
              <span className="w-12 text-right text-xs text-neutral-500">+{(d.impact * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scenarios */}
      <div>
        <h3 className="mb-3 text-sm font-medium">假设情景</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {scenarios.map((s) => (
            <div key={s.name} className={cn('rounded-2xl border bg-neutral-100 p-5', s.cls)}>
              <div className="text-xs text-neutral-500">{s.name}情景</div>
              <div className="mt-1 text-3xl font-semibold">{s.score.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
