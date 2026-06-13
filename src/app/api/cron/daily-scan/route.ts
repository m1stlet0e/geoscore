import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

// Daily scan: create ScanRun + trigger execution
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

  const cnPlatforms = ['deepseek', 'tongyi', 'wenxin', 'zhipu', 'kimi', 'doubao', 'yuanbao'];
  const results: { brandId: string; scanId: string; executed: boolean }[] = [];

  for (const brand of brands) {
    // Count active prompts
    const promptCount = await prisma.prompt.count({
      where: { brandId: brand.id, isActive: true },
    });
    if (promptCount === 0) {
      results.push({ brandId: brand.id, scanId: '', executed: false });
      continue;
    }

    // Create scan
    const scan = await prisma.scanRun.create({
      data: {
        brandId: brand.id,
        userId: brand.userId,
        status: 'running',
        platforms: cnPlatforms,
        totalPrompts: promptCount,
        triggeredBy: authz.isCron ? 'cron' : 'user',
      },
    });

    // Execute scan inline (call the same logic as /api/scans/[id]/execute)
    try {
      const baseUrl = req.nextUrl.origin;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      // For cron mode, pass the cron secret; for user mode, forward cookies
      if (authz.isCron) {
        headers['authorization'] = `Bearer ${process.env.CRON_SECRET}`;
      } else {
        const cookie = req.headers.get('cookie') || '';
        headers['cookie'] = cookie;
      }

      const execRes = await fetch(`${baseUrl}/api/scans/${scan.id}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ triggeredBy: authz.isCron ? 'cron' : 'user' }),
      });

      results.push({
        brandId: brand.id,
        scanId: scan.id,
        executed: execRes.ok,
      });
    } catch {
      results.push({ brandId: brand.id, scanId: scan.id, executed: false });
    }
  }

  return NextResponse.json({
    ok: true,
    brandCount: brands.length,
    triggeredBy: authz.isCron ? 'cron' : 'user',
    scans: results,
  });
}
