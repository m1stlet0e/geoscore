import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Helper: detect cron mode
function isCron(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

async function ensureAuth(req: NextRequest) {
  if (isCron(req)) return { userId: null, isCron: true };
  const { auth } = await import('@/auth');
  const session = await auth();
  if (!session?.user) return { userId: null, isCron: false };
  return { userId: (session.user as { id: string }).id, isCron: false };
}

// Daily scan: trigger one scan per active brand
export async function POST(req: NextRequest) {
  const authz = await ensureAuth(req);
  if (!authz.isCron && !authz.userId) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const where = authz.isCron ? { status: 'active' } : { status: 'active', userId: authz.userId };
  const brands = await prisma.brand.findMany({ where });
  if (brands.length === 0) {
    return NextResponse.json({ ok: true, brandCount: 0, message: '无活跃品牌' });
  }

  const results: { brandId: string; scanId: string }[] = [];
  for (const brand of brands) {
    const scan = await prisma.scanRun.create({
      data: {
        brandId: brand.id,
        userId: brand.userId,
        status: 'running',
        platforms: ['chatgpt', 'gemini', 'claude', 'perplexity', 'google_aio', 'mistral', 'deepseek'],
        totalPrompts: 0,
        triggeredBy: authz.isCron ? 'cron' : 'user',
      },
    });
    results.push({ brandId: brand.id, scanId: scan.id });
  }

  return NextResponse.json({
    ok: true,
    brandCount: brands.length,
    triggeredBy: authz.isCron ? 'cron' : 'user',
    scans: results,
  });
}
