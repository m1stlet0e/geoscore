import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const sources = await prisma.citationSource.findMany({
    where: { brandId, userId },
    orderBy: { citationCount: 'desc' },
    take: 500,
  });

  const total = sources.reduce((acc, s) => acc + s.citationCount, 0) || 1;
  const byDomain = new Map<string, { domain: string; citationCount: number; weight: number; platforms: Map<string, number> }>();

  for (const s of sources) {
    const d = s.domain.toLowerCase();
    const cur = byDomain.get(d);
    if (cur) {
      cur.citationCount += s.citationCount;
      cur.weight = Math.max(cur.weight, s.weight);
      cur.platforms.set(s.platform, (cur.platforms.get(s.platform) ?? 0) + s.citationCount);
    } else {
      const platforms = new Map<string, number>();
      platforms.set(s.platform, s.citationCount);
      byDomain.set(d, {
        domain: d,
        citationCount: s.citationCount,
        weight: s.weight,
        platforms,
      });
    }
  }

  const out = Array.from(byDomain.values())
    .map((d) => {
      const topPlatforms = Array.from(d.platforms.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([platform, n]) => ({ platform, count: n }));
      return {
        domain: d.domain,
        weightPct: Math.round((d.citationCount / total) * 1000) / 10,
        weight: d.weight,
        citationCount: d.citationCount,
        topPlatforms,
      };
    })
    .sort((a, b) => b.citationCount - a.citationCount);

  return NextResponse.json({ sources: out, total: sources.length });
}
