import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  domain: z.string().max(200).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  competitors: z.array(z.string().min(1).max(80)).max(20).optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  const brand = await prisma.brand.findFirst({
    where: { id, userId },
    include: {
      _count: { select: { prompts: true, scans: true, citations: true, contentPieces: true } },
    },
  });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });
  return NextResponse.json({ brand });
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
      { error: parsed.error.issues[0]?.message ?? '参数错误', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.brand.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const dup = await prisma.brand.findUnique({
      where: { userId_name: { userId, name: parsed.data.name } },
    });
    if (dup) return NextResponse.json({ error: '已存在同名品牌' }, { status: 400 });
  }

  const brand = await prisma.brand.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ brand });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await ctx.params;

  const existing = await prisma.brand.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  await prisma.brand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
