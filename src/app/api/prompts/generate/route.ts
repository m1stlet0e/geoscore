import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { jsonChat } from '@/lib/deepseek';
import { PROMPT_CATEGORIES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  brandId: z.string().min(1),
  count: z.number().int().min(1).max(200).optional().default(50),
});

const CATEGORY_IDS = PROMPT_CATEGORIES.map((c) => c.id) as [string, ...string[]];

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
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    );
  }

  const brand = await prisma.brand.findFirst({ where: { id: parsed.data.brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const count = parsed.data.count ?? 50;
  const categories = PROMPT_CATEGORIES.map((c) => `${c.id}(${c.label}: ${c.desc})`).join('、');
  const competitors = (brand.competitors ?? []).slice(0, 5).join('、') || '无';
  const sys = `你是一个 GEO 优化专家，擅长为品牌挖掘用户在 AI 搜索中会问的真实问题。
品牌名：${brand.name}
品牌领域：${brand.category ?? '未指定'}
品牌描述：${brand.description ?? '未指定'}
竞品：${competitors}

请输出 ${count} 条用户可能向 ChatGPT / Perplexity / Gemini 等 AI 助手提问的中文 prompt。
要求：
1. 覆盖以下类别：${categories}
2. 至少 30% 包含竞品名或对比意图
3. 语言自然，符合真实用户口吻
4. 每条 8-40 字
5. category 必须是上述 ID 之一；intent 从 ["推荐","对比","评测","教程","替代","价格"] 中选一个
6. 严格返回 JSON：{"prompts":[{"text":"...","category":"recommend","intent":"推荐"}]}`;

  let generated: { text: string; category: string; intent: string }[] = [];
  try {
    const out = await jsonChat<{ prompts: { text: string; category: string; intent: string }[] }>(
      [
        { role: 'system', content: sys },
        { role: 'user', content: `生成 ${count} 条 prompt` },
      ],
      { maxTokens: 4000, temperature: 0.8 }
    );
    if (Array.isArray(out?.prompts)) {
      generated = out.prompts.filter((p) => p && typeof p.text === 'string' && p.text.length > 1);
    }
  } catch (err) {
    return NextResponse.json(
      { error: `生成失败：${err instanceof Error ? err.message : '未知错误'}` },
      { status: 502 }
    );
  }

  if (generated.length === 0) {
    return NextResponse.json({ error: 'AI 未返回有效 prompt' }, { status: 502 });
  }

  // Persist
  const rows = generated.slice(0, count).map((p) => ({
    brandId: brand.id,
    userId,
    text: p.text.slice(0, 500),
    category: CATEGORY_IDS.includes(p.category as never) ? p.category : null,
    intent: p.intent?.slice(0, 40) ?? null,
    language: 'zh',
    isActive: true,
  }));
  const result = await prisma.prompt.createMany({ data: rows, skipDuplicates: true });

  return NextResponse.json(
    { generated: rows.length, persisted: result.count, prompts: rows },
    { status: 201 }
  );
}
