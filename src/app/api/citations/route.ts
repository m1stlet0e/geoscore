import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLATFORM_IDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const platform = searchParams.get('platform');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const where: { brandId: string; userId: string; platform?: string; createdAt?: { gte?: Date; lte?: Date } } = {
    brandId,
    userId,
  };
  if (platform && PLATFORM_IDS.includes(platform as never)) where.platform = platform;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const citations = await prisma.citation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const total = citations.length;

  // By platform
  const byPlatform: Record<string, number> = {};
  for (const p of PLATFORM_IDS) byPlatform[p] = 0;
  for (const c of citations) byPlatform[c.platform] = (byPlatform[c.platform] ?? 0) + 1;

  // By day (last 30 days, YYYY-MM-DD)
  const byDayMap = new Map<string, number>();
  for (const c of citations) {
    const k = c.createdAt.toISOString().slice(0, 10);
    byDayMap.set(k, (byDayMap.get(k) ?? 0) + 1);
  }
  const byDay = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Top sources — flatten sources JSON
  const sourceAgg = new Map<string, { domain: string; url: string; count: number; title?: string | null }>();
  for (const c of citations) {
    const sources = Array.isArray(c.sources) ? (c.sources as { url?: string; domain?: string; title?: string }[]) : [];
    for (const s of sources) {
      const url = (s.url ?? '').slice(0, 500);
      if (!url) continue;
      const domain = (s.domain ?? '').toLowerCase();
      const key = `${c.platform}::${url}`;
      const cur = sourceAgg.get(key);
      if (cur) cur.count += 1;
      else sourceAgg.set(key, { domain, url, count: 1, title: s.title ?? null });
    }
  }
  const topSources = Array.from(sourceAgg.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top prompts
  const promptAgg = new Map<string, { text: string; count: number; platforms: Set<string> }>();
  for (const c of citations) {
    const cur = promptAgg.get(c.promptText);
    if (cur) {
      cur.count += 1;
      cur.platforms.add(c.platform);
    } else {
      promptAgg.set(c.promptText, { text: c.promptText, count: 1, platforms: new Set([c.platform]) });
    }
  }
  const topPrompts = Array.from(promptAgg.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((p) => ({ text: p.text, count: p.count, platforms: Array.from(p.platforms) }));

  return NextResponse.json({
    total,
    byPlatform,
    byDay,
    topSources,
    topPrompts,
  });
}
