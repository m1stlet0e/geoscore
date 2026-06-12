import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { prisma } from '@/lib/prisma';
import { Share2, Network as NetworkIcon, Hash, Sparkles } from 'lucide-react';
import { InfluenceGraph } from './_graph';

export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  brand: '品牌',
  category: '品类',
  feature: '功能',
  subniche: '子赛道',
  competitor: '竞品',
};

const TYPE_COLOR: Record<string, string> = {
  brand: '#6366f1',
  category: '#10b981',
  feature: '#f59e0b',
  subniche: '#22b8cd',
  competitor: '#ec4899',
};

export default async function InfluencePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;

  const [nodes, edges] = await Promise.all([
    prisma.brandGraphNode.findMany({ where: { userId } }),
    prisma.brandGraphEdge.findMany({ where: { userId } }),
  ]);

  if (nodes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="MODULE 4"
          title="AI 品牌影响力地图"
          subtitle="可视化品牌在 AI 知识图谱中的位置、关系与竞品邻近度。"
        />
        <EmptyState
          icon={<Share2 className="h-5 w-5" />}
          title="影响力图谱暂未生成"
          description="完成至少一次扫描后,GeoScore 会自动构建品牌 × 竞品 × 品类 × 子赛道的知识图谱。"
          ctaLabel="前往监控中心"
          ctaHref="/monitor"
        />
      </div>
    );
  }

  // Identify "your brand" nodes (type=brand) and find their top competitors
  const brandNodes = nodes.filter((n) => n.type === 'brand');
  const competitorNodes = nodes.filter((n) => n.type === 'competitor');

  // For each brand node, sum edge weights to competitor nodes
  const brandCompetitorWeights: Record<string, { competitorId: string; weight: number }[]> = {};
  for (const e of edges) {
    if (!brandCompetitorWeights[e.from]) brandCompetitorWeights[e.from] = [];
    brandCompetitorWeights[e.from].push({ competitorId: e.to, weight: e.weight });
  }
  const topCompetitors = brandNodes[0]
    ? (brandCompetitorWeights[brandNodes[0].id] ?? [])
        .map((c) => {
          const node = nodes.find((n) => n.id === c.competitorId);
          return node ? { node, weight: c.weight } : null;
        })
        .filter((x): x is { node: typeof nodes[number]; weight: number } => x !== null)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
    : [];

  // Build competitor comparison matrix
  const matrix = brandNodes.slice(0, 1).flatMap((brand) => {
    const linkedEdges = edges.filter((e) => e.from === brand.id || e.to === brand.id);
    return competitorNodes.slice(0, 8).map((comp) => {
      const relatedEdge = linkedEdges.find(
        (e) => e.from === comp.id || e.to === comp.id
      );
      return {
        competitor: comp,
        weight: relatedEdge?.weight ?? 0,
        edgeType: relatedEdge?.type ?? null,
      };
    });
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="MODULE 4"
        title="AI 品牌影响力地图"
        subtitle="可视化品牌在 AI 知识图谱中的位置、关系与竞品邻近度。"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main graph */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-800">知识图谱</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                节点大小 = 权重 · 颜色 = 类型 · 边粗细 = 关联强度
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
              {Object.entries(TYPE_COLOR).map(([type, color]) => (
                <span key={type} className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: color }}
                  />
                  {TYPE_LABEL[type] ?? type}
                </span>
              ))}
            </div>
          </div>
          <InfluenceGraph
            nodes={nodes.map((n) => ({
              id: n.id,
              label: n.label,
              type: n.type,
              weight: n.weight,
              x: n.x,
              y: n.y,
              color: TYPE_COLOR[n.type] ?? '#6366f1',
            }))}
            edges={edges.map((e) => ({
              id: e.id,
              from: e.from,
              to: e.to,
              weight: e.weight,
              type: e.type,
            }))}
          />
        </div>

        {/* Top competitors side panel */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-base font-semibold text-neutral-800">最邻近竞品</h2>
          <p className="mt-0.5 text-xs text-neutral-500">按与你品牌的关联强度排序</p>
          {topCompetitors.length === 0 ? (
            <div className="mt-6 flex flex-col items-center text-center text-sm text-neutral-500">
              <NetworkIcon className="mb-2 h-6 w-6 text-neutral-500" />
              暂无竞品关系数据
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {topCompetitors.map((c, i) => (
                <li
                  key={c.node.id}
                  className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 p-3 transition hover:border-neutral-300"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                      style={{
                        background: `${TYPE_COLOR.competitor}26`,
                        color: TYPE_COLOR.competitor,
                      }}
                    >
                      #{i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-800">
                        {c.node.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {TYPE_LABEL[c.node.type] ?? c.node.type} · 权重 {c.weight.toFixed(2)}
                      </p>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, c.weight * 100)}%`,
                            background: TYPE_COLOR.competitor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Competitor comparison matrix */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">竞品对比矩阵</h2>
            <p className="mt-0.5 text-xs text-neutral-500">知识图谱中与你关系最强的竞品</p>
          </div>
        </div>
        {matrix.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-500">暂无对比数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-2 py-2 font-medium">竞品</th>
                  <th className="px-2 py-2 font-medium">类型</th>
                  <th className="px-2 py-2 font-medium">关联强度</th>
                  <th className="px-2 py-2 font-medium">关系类型</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/40">
                {matrix.map((m) => (
                  <tr key={m.competitor.id} className="transition hover:bg-neutral-100">
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: TYPE_COLOR[m.competitor.type] ?? '#6366f1' }}
                        />
                        <span className="font-medium text-neutral-800">{m.competitor.label}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <span className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                        {TYPE_LABEL[m.competitor.type] ?? m.competitor.type}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${Math.min(100, m.weight * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-neutral-500">
                          {m.weight.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      {m.edgeType ? (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                          <Hash className="h-3 w-3" /> {m.edgeType}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-500">无关联</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
