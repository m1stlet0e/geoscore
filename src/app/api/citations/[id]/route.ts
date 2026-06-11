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

  const citation = await prisma.citation.findFirst({
    where: { id, userId },
    include: { brand: { select: { id: true, name: true, domain: true, category: true } } },
  });
  if (!citation) return NextResponse.json({ error: '引用不存在' }, { status: 404 });
  return NextResponse.json({ citation });
}
