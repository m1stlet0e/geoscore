import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLAN_LIMITS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CreateBody = z.object({
  name: z.string().min(1, '品牌名称必填').max(80),
  domain: z.string().max(200).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  competitors: z.array(z.string().min(1).max(80)).max(20).optional().default([]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const brands = await prisma.brand.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          prompts: true,
          scans: true,
          citations: true,
          contentPieces: true,
        },
      },
    },
  });
  return NextResponse.json({ brands });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Plan limit check
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const plan = (user?.plan ?? 'FREE') as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan].keywords;
  if (limit !== -1) {
    const count = await prisma.brand.count({ where: { userId } });
    if (count >= limit) {
      return NextResponse.json(
        { error: `当前套餐最多创建 ${limit} 个品牌，请升级套餐` },
        { status: 403 }
      );
    }
  }

  // Unique check (userId+name)
  const dup = await prisma.brand.findUnique({
    where: { userId_name: { userId, name: parsed.data.name } },
  });
  if (dup) {
    return NextResponse.json({ error: '已存在同名品牌' }, { status: 400 });
  }

  const brand = await prisma.brand.create({
    data: {
      userId,
      name: parsed.data.name,
      domain: parsed.data.domain ?? null,
      description: parsed.data.description ?? null,
      category: parsed.data.category ?? null,
      competitors: parsed.data.competitors ?? [],
      status: 'active',
    },
  });

  return NextResponse.json({ brand }, { status: 201 });
}
