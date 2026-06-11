import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  const existing = await prisma.prompt.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'prompt 不存在' }, { status: 404 });

  await prisma.prompt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
