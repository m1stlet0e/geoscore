import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { jsonChat } from '@/lib/deepseek';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const horizon = Math.min(parseInt(searchParams.get('horizon') ?? '30', 10) || 30, 180);

  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });
  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  // Pull recent citation stats
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const citations = await prisma.citation.findMany({
    where: { brandId, userId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const trends = await prisma.trendSignal.findMany({
    where: { OR: [{ userId, brandId }, { userId, brandId: null }] },
    orderBy: { growthPct: 'desc' },
    take: 20,
  });
  const recentScans = await prisma.scanRun.findMany({
    where: { brandId, userId, status: 'completed' },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });

  // No data → seeded forecast
  if (citations.length < 3) {
    const seed = await prisma.forecast.create({
      data: {
        brandId: brand.id,
        userId,
        horizonDays: horizon,
        predictedScore: 50 + Math.round(Math.random() * 25),
        predictedRank: 3 + Math.random() * 2,
        confidence: 0.4,
        drivers: [
          { factor: 'seed_estimate', impact: 0.5, note: '数据不足，使用基于品类的默认预测' },
          { factor: 'category_growth', impact: 0.3, note: `${brand.category ?? 'AI'} 品类整体增长` },
        ],
      },
    });
    return NextResponse.json({ forecast: seed, source: 'seed' });
  }

  // Build a compact summary for the LLM
  const byPlatform: Record<string, number> = {};
  for (const c of citations) byPlatform[c.platform] = (byPlatform[c.platform] ?? 0) + 1;
  const topPrompts = Array.from(
    citations.reduce((acc, c) => {
      acc.set(c.promptText, (acc.get(c.promptText) ?? 0) + 1);
      return acc;
    }, new Map<string, number>()).entries()
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, n]) => `${t} (${n})`);

  const sys = `你是一个 GEO 预测专家。基于品牌 ${horizon} 天内的 AI 引用数据，预测未来可见度分数（0-100）、预测平均排名（1-5，1 最好）、置信度（0-1），并给出 2-4 个关键驱动因素。
返回 JSON：{"predictedScore":number, "predictedRank":number, "confidence":number, "drivers":[{"factor":"...", "impact":number, "note":"..."}]}`;

  let parsed: { predictedScore: number; predictedRank: number; confidence: number; drivers: { factor: string; impact: number; note?: string }[] } | null = null;
  try {
    parsed = await jsonChat<typeof parsed>(
      [
        { role: 'system', content: sys },
        {
          role: 'user',
          content: `品牌: ${brand.name} (领域: ${brand.category ?? 'AI'})
近 30 天引用数: ${citations.length}
按平台: ${JSON.stringify(byPlatform)}
热门 prompt: ${topPrompts.join('; ')}
趋势信号数: ${trends.length}（增长最高的: ${trends.slice(0, 3).map((t) => `${t.text} (${t.growthPct}%)`).join('、')}）
已完成扫描: ${recentScans.length}
请预测未来 ${horizon} 天。`,
        },
      ],
      { maxTokens: 600, temperature: 0.5 }
    );
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed.predictedScore !== 'number') {
    // Fallback
    parsed = {
      predictedScore: Math.min(95, Math.max(20, Math.round((citations.length / 30) * 100))),
      predictedRank: citations.length > 50 ? 2 : citations.length > 20 ? 3 : 4,
      confidence: 0.55,
      drivers: [
        { factor: 'citation_volume', impact: 0.45, note: `近 30 天 ${citations.length} 条引用` },
        { factor: 'platform_coverage', impact: 0.25, note: `覆盖 ${Object.keys(byPlatform).length} 个 AI 平台` },
      ],
    };
  }

  const forecast = await prisma.forecast.create({
    data: {
      brandId: brand.id,
      userId,
      horizonDays: horizon,
      predictedScore: Math.max(0, Math.min(100, Math.round(parsed.predictedScore))),
      predictedRank: Math.max(1, Math.min(10, parsed.predictedRank)),
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      drivers: parsed.drivers.map((d) => ({
        factor: String(d.factor).slice(0, 60),
        impact: typeof d.impact === 'number' ? d.impact : 0,
        note: d.note ? String(d.note).slice(0, 200) : undefined,
      })),
    },
  });

  return NextResponse.json({ forecast, source: 'llm' });
}
