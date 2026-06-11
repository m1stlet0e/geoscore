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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 50);

  const scans = await prisma.scanRun.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      brand: { select: { id: true, name: true, domain: true } },
      _count: { select: { promptScans: true } },
    },
  });
  return NextResponse.json({ scans });
}
