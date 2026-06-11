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

  const competitors = (brand.competitors ?? []).slice(0, 20);
  if (competitors.length === 0) {
    return NextResponse.json({ competitors: [], message: '该品牌暂未配置竞品' });
  }

  // For each competitor, count citations where they co-occur in prompt/answer text
  // with our brand. We use a cheap regex scan over recent citations.
  const recent = await prisma.citation.findMany({
    where: { brandId, userId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Also look at promptScans indirectly via prompts
  const prompts = await prisma.prompt.findMany({
    where: { brandId, userId },
    select: { id: true, text: true },
    take: 200,
  });

  const results = competitors.map((comp) => {
    const lc = comp.toLowerCase();
    let sharedPrompts = 0;
    let totalPrompts = prompts.length;
    for (const p of prompts) {
      if (p.text.toLowerCase().includes(lc)) sharedPrompts += 1;
    }
    let coCitations = 0;
    for (const c of recent) {
      const hay = `${c.answerText ?? ''} ${c.promptText ?? ''}`.toLowerCase();
      if (hay.includes(lc)) coCitations += 1;
    }
    return {
      name: comp,
      sharedPrompts,
      totalPrompts,
      overlapPct: totalPrompts === 0 ? 0 : Math.round((sharedPrompts / totalPrompts) * 1000) / 10,
      coCitations,
    };
  });

  // Sort by overlap descending
  results.sort((a, b) => b.sharedPrompts + b.coCitations * 0.5 - (a.sharedPrompts + a.coCitations * 0.5));

  return NextResponse.json({ competitors: results });
}
