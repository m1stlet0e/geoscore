import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  const forecast = await prisma.forecast.findFirst({
    where: { id, userId },
    include: { brand: { select: { id: true, name: true, category: true } } },
  });
  if (!forecast) return NextResponse.json({ error: '预测不存在' }, { status: 404 });
  return NextResponse.json({ forecast });
}
