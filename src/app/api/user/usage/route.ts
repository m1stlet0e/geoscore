import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLAN_LIMITS } from '@/lib/constants';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = (user?.plan || 'FREE') as keyof typeof PLAN_LIMITS;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [brands, prompts, scansToday] = await Promise.all([
    prisma.brand.count({ where: { userId } }),
    prisma.prompt.count({ where: { userId } }),
    prisma.scanRun.count({ where: { userId, startedAt: { gte: startOfDay } } }),
  ]);
  const limits = PLAN_LIMITS[plan];
  return NextResponse.json({
    plan,
    limits,
    used: { brands, prompts, scansToday },
    pct: {
      brands: limits.brands === -1 ? 0 : Math.min(100, Math.round((brands / limits.brands) * 100)),
      prompts: limits.prompts === -1 ? 0 : Math.min(100, Math.round((prompts / limits.prompts) * 100)),
      scansToday: limits.scansPerDay === -1 ? 0 : Math.min(100, Math.round((scansToday / limits.scansPerDay) * 100)),
    },
  });
}
