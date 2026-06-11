import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLATFORM_IDS, PLAN_LIMITS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CreateBody = z.object({
  brandId: z.string().min(1),
  platforms: z.array(z.enum(PLATFORM_IDS as unknown as [string, ...string[]])).min(1).max(7),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);

  const where: { userId: string; brandId?: string } = { userId };
  if (brandId) where.brandId = brandId;

  const scans = await prisma.scanRun.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      brand: { select: { id: true, name: true, domain: true } },
      _count: { select: { promptScans: true } },
    },
  });
  return NextResponse.json({ scans, total: scans.length });
}

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
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    );
  }

  const brand = await prisma.brand.findFirst({
    where: { id: parsed.data.brandId, userId },
  });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  // Plan limit — scans per day
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const plan = (user?.plan ?? 'FREE') as keyof typeof PLAN_LIMITS;
  const perDay = PLAN_LIMITS[plan].scansPerDay;
  if (perDay !== -1) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = await prisma.scanRun.count({
      where: { userId, startedAt: { gte: startOfDay } },
    });
    if (today >= perDay) {
      return NextResponse.json(
        { error: `今日扫描次数已用完（${perDay} 次/天），请升级套餐或明日再试` },
        { status: 403 }
      );
    }
  }

  const promptCount = await prisma.prompt.count({
    where: { brandId: brand.id, userId, isActive: true },
  });
  if (promptCount === 0) {
    return NextResponse.json(
      { error: '该品牌还没有 prompt，请先到 Prompts 页面生成或添加' },
      { status: 400 }
    );
  }

  const scan = await prisma.scanRun.create({
    data: {
      brandId: brand.id,
      userId,
      status: 'queued',
      totalPrompts: promptCount,
      completedPrompts: 0,
      platforms: parsed.data.platforms,
      triggeredBy: 'user',
    },
    include: { brand: { select: { id: true, name: true, domain: true } } },
  });

  // Auto-enqueue for execution (fire-and-forget; route is POST-handler)
  // We use the same execute logic via a non-awaited internal call.
  // To avoid hanging the response, just kick it off without await.
  void runScanInBackground(scan.id).catch((err) => {
    console.error('[scan] background run failed', scan.id, err);
  });

  return NextResponse.json({ scan }, { status: 201 });
}

// Internal background runner — uses fetch with no auth (relies on cron header
// would be wrong; instead we just call the execute logic in-process by setting
// a sentinel. For simplicity & correctness in a single Node runtime, this
// executes inline but doesn't block the HTTP response.
async function runScanInBackground(scanId: string) {
  // Inline execution: load the scan, mark running, iterate, mark completed.
  const scan = await prisma.scanRun.findUnique({ where: { id: scanId } });
  if (!scan) return;
  await prisma.scanRun.update({ where: { id: scanId }, data: { status: 'running' } });

  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://127.0.0.1:18200';
    const secret = process.env.CRON_SECRET || '';
    // Fire and forget; the execute route itself handles DB writes.
    await fetch(`${baseUrl}/api/scans/${scanId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ triggeredBy: 'user' }),
    }).catch(() => null);
  } catch {
    // ignore — execute route has its own error handling
  }
}
