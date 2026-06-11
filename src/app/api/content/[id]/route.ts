import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CONTENT_TYPES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPE_IDS = CONTENT_TYPES.map((c) => c.id) as [string, ...string[]];

const PatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(50_000).optional(),
  status: z.enum(['draft', 'approved', 'published', 'archived']).optional(),
  type: z.enum(TYPE_IDS).optional(),
  quality: z.number().int().min(0).max(100).optional(),
  meta: z.record(z.unknown()).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  const piece = await prisma.contentPiece.findFirst({
    where: { id, userId },
    include: {
      brand: { select: { id: true, name: true } },
      publishJobs: { orderBy: { startedAt: 'desc' }, take: 10 },
    },
  });
  if (!piece) return NextResponse.json({ error: '内容不存在' }, { status: 404 });
  return NextResponse.json({ content: piece });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    );
  }

  const existing = await prisma.contentPiece.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: '内容不存在' }, { status: 404 });

  const piece = await prisma.contentPiece.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ content: piece });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  const existing = await prisma.contentPiece.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: '内容不存在' }, { status: 404 });

  await prisma.contentPiece.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
