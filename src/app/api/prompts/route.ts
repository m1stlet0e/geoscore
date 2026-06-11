import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PROMPT_CATEGORIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATEGORY_IDS = PROMPT_CATEGORIES.map((c) => c.id) as [string, ...string[]];

const CreateBody = z.object({
  brandId: z.string().min(1),
  text: z.string().min(2, 'prompt 至少 2 个字').max(500),
  category: z.enum(CATEGORY_IDS).optional().nullable(),
  intent: z.string().max(40).optional().nullable(),
  language: z.string().max(10).optional().default('zh'),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const prompts = await prisma.prompt.findMany({
    where: { brandId, userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ prompts, total: prompts.length });
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
  const brand = await prisma.brand.findFirst({
    where: { id: parsed.data.brandId, userId },
  });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const prompt = await prisma.prompt.create({
    data: {
      brandId: parsed.data.brandId,
      userId,
      text: parsed.data.text.trim(),
      category: parsed.data.category ?? null,
      intent: parsed.data.intent ?? null,
      language: parsed.data.language ?? 'zh',
      isActive: true,
    },
  });
  return NextResponse.json({ prompt }, { status: 201 });
}
