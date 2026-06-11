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

  const scan = await prisma.scanRun.findFirst({
    where: { id, userId },
    include: {
      brand: { select: { id: true, name: true, domain: true, category: true } },
      promptScans: {
        orderBy: { createdAt: 'asc' },
        include: { prompt: { select: { id: true, text: true, category: true, intent: true } } },
        take: 500,
      },
    },
  });
  if (!scan) return NextResponse.json({ error: '扫描不存在' }, { status: 404 });
  return NextResponse.json({ scan });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  const existing = await prisma.scanRun.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: '扫描不存在' }, { status: 404 });

  await prisma.scanRun.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
