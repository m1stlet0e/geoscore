import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLAN_LIMITS } from '@/lib/constants';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [user, brandCount, promptCount, scansToday, contentCount, recentAlerts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.brand.count({ where: { userId } }),
    prisma.prompt.count({ where: { userId } }),
    prisma.scanRun.count({ where: { userId, startedAt: { gte: startOfDay } } }),
    prisma.contentPiece.count({ where: { userId } }),
    prisma.alert.count({ where: { userId, isRead: false } }),
  ]);

  const plan = (user?.plan || 'FREE') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan];

  return NextResponse.json({
    user: { id: user?.id, email: user?.email, name: user?.name, plan, planExpiresAt: user?.planExpiresAt },
    usage: {
      brands: brandCount,
      prompts: promptCount,
      scansToday,
      contentPieces: contentCount,
      unreadAlerts: recentAlerts,
    },
    limits,
  });
}
