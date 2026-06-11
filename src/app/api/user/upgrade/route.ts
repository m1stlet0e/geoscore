import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const body = (await req.json()) as { plan?: string };
  const allowed = ['FREE', 'PRO', 'GROWTH', 'ENTERPRISE'] as const;
  if (!body.plan || !(allowed as readonly string[]).includes(body.plan)) {
    return NextResponse.json({ error: '无效的计划' }, { status: 400 });
  }
  const expiresAt = body.plan === 'FREE' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { plan: body.plan as 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE', planExpiresAt: expiresAt },
  });
  return NextResponse.json({ user: { id: user.id, plan: user.plan, planExpiresAt: user.planExpiresAt } });
}
