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
  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const where: { brandId: string; userId: string; platform?: string } = { brandId, userId };
  if (platform && PLATFORM_IDS.includes(platform as never)) where.platform = platform;

  const sources = await prisma.citationSource.findMany({
    where,
    orderBy: [{ citationCount: 'desc' }, { lastSeen: 'desc' }],
    take: 200,
  });

  // Aggregate by domain
  const byDomain = new Map<
    string,
    {
      domain: string;
      citationCount: number;
      weight: number;
      lastSeen: string;
      urls: { url: string; platform: string; citationCount: number; title: string | null }[];
    }
  >();

  for (const s of sources) {
    const d = s.domain.toLowerCase();
    const cur = byDomain.get(d);
    if (cur) {
      cur.citationCount += s.citationCount;
      cur.weight = Math.max(cur.weight, s.weight);
      if (new Date(s.lastSeen) > new Date(cur.lastSeen)) cur.lastSeen = s.lastSeen.toISOString();
      cur.urls.push({
        url: s.url,
        platform: s.platform,
        citationCount: s.citationCount,
        title: s.title,
      });
    } else {
      byDomain.set(d, {
        domain: d,
        citationCount: s.citationCount,
        weight: s.weight,
        lastSeen: s.lastSeen.toISOString(),
        urls: [{ url: s.url, platform: s.platform, citationCount: s.citationCount, title: s.title }],
      });
    }
  }

  const aggregated = Array.from(byDomain.values()).sort((a, b) => b.citationCount - a.citationCount);
  return NextResponse.json({ sources: aggregated, total: aggregated.length });
}
