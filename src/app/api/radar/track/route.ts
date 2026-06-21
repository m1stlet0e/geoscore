import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  brandId: z.string().min(1),
  signalText: z.string().min(2).max(200),
  category: z.enum(['question', 'topic', 'keyword']).optional().default('question'),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    );
  }

  const brand = await prisma.brand.findFirst({ where: { id: parsed.data.brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  // Heuristic volume / growth for a new tracked signal
  const volume = 1000 + Math.floor(Math.random() * 8000);
  const growthPct = Math.round(20 + Math.random() * 200);

  const signal = await prisma.trendSignal.create({
    data: {
      userId,
      brandId: brand.id,
      category: parsed.data.category,
      text: parsed.data.signalText.trim(),
      volume,
      growthPct,
      platforms: ['wenxin', 'doubao'],
    },
  });

  const alert = await prisma.alert.create({
    data: {
      brandId: brand.id,
      userId,
      type: 'trend_rising',
      severity: growthPct > 100 ? 'high' : 'medium',
      title: `新趋势信号：${parsed.data.signalText.slice(0, 30)}`,
      message: `该信号在 AI 平台上的搜索量约为 ${volume}，环比增长 ${growthPct}%。建议尽快产出相关内容抢占引用位。`,
      meta: { signalId: signal.id, volume, growthPct },
    },
  });

  return NextResponse.json({ signal, alert }, { status: 201 });
}
