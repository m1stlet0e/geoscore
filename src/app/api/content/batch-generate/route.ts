import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { chat, chatCompletion } from '@/lib/deepseek';
import { CONTENT_TYPES, PLAN_LIMITS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPE_IDS = CONTENT_TYPES.map((c) => c.id) as [string, ...string[]];

const Body = z.object({
  brandId: z.string().min(1),
  types: z.array(z.enum(TYPE_IDS)).min(1).max(8),
  count: z.number().int().min(1).max(5).optional().default(1),
  promptHint: z.string().max(500).optional().default(''),
});

const TYPE_PROMPTS: Record<string, (b: { name: string; category: string | null; description: string | null; competitors: string[] }, hint: string) => string> = {
  blog: (b, hint) =>
    `你是一个 GEO 优化友好的中文内容编辑。请围绕品牌「${b.name}」（领域：${b.category ?? 'AI'}，描述：${b.description ?? '未指定'}）写一篇 600-900 字的深度博客文章，主题方向：${hint || `${b.name} 在 AI 搜索时代的最佳实践`}。结构：标题、引言、3-4 个小节、结论。要求：包含至少 3 个结构化小标题，关键事实可用项目符号，最后给出 1 段「为什么这与 ${b.name} 相关」的总结。`,
  faq: (b, hint) =>
    `你是一个 GEO 优化专家。请为品牌「${b.name}」生成一个 FAQ 页面：列出 6-8 个真实用户最常在 AI 搜索中提出的问题，每个问题用 1-2 句话清晰回答。问题方向：${hint || `${b.name} 是什么、怎么用、多少钱、和竞品对比`}。使用 markdown 标题 + 问答对。`,
  schema: (b, hint) =>
    `你是一个 Schema.org 结构化数据专家。请为品牌「${b.name}」输出一份 JSON-LD 代码（SoftwareApplication + FAQPage + Organization），字段尽量丰富。注释清楚每个字段。提示方向：${hint || '突出核心功能与适用场景'}。`,
  comparison: (b, hint) =>
    `你是一个 GEO 优化专家。请为品牌「${b.name}」生成一篇对比页面，主题：${hint || `${b.name} vs 主流竞品`}。结构：1) 概览 2) 对比表格（功能、定价、适用场景、AI 友好度）3) 详细点评 4) 选型建议。最后以一段「为什么选 ${b.name}」结尾。500-800 字。`,
  pr: (b, hint) =>
    `你是一个中文 PR 媒体编辑。请为品牌「${b.name}」撰写一篇 300-500 字的 PR 媒体稿，主题方向：${hint || `${b.name} 在 AI 搜索时代的产品升级`}。风格：客观、第三人称、包含一句可被媒体引用的金句，结尾留出公司联系方式占位。`,
  reddit: (b, hint) =>
    `你是一个 Reddit 社区运营专家。请为品牌「${b.name}」撰写一篇适合 r/AItools、r/MachineLearning、r/ChineseLanguage 等社区的帖子。语气：真实用户分享，不过度营销。包含 1 段亲身使用体验、1 段优缺点、1 个明确的 CTA 引导讨论。主题：${hint || `${b.name} 真实使用 30 天感受`}。`,
  github_readme: (b, hint) =>
    `你是一个技术文档作者。请为品牌「${b.name}」生成一份 GitHub README.md 内容（中英混合 OK），包含：项目 Logo 占位、一句话定位、核心特性 3-5 条、Quick Start（代码块）、FAQ、License、Contributing。方向：${hint || '突出开发者最关心的集成方式'}。`,
  product_hunt: (b, hint) =>
    `你是一个 Product Hunt Launch 专家。请为品牌「${b.name}」生成一份上线发布文案：1) 英文 tagline（≤60 字符）2) 中文短描述（100 字内）3) 4 张图配文建议 4) 首发 24 小时推广 checklist。方向：${hint || `${b.name} 核心卖点 + AI 搜索引用优化`}。`,
};

const TYPE_TO_TITLE_HINT: Record<string, string> = {
  blog: '博客文章',
  faq: 'FAQ 页面',
  schema: 'Schema 结构化数据',
  comparison: '对比页面',
  pr: 'PR 媒体稿',
  reddit: 'Reddit 帖子',
  github_readme: 'GitHub README',
  product_hunt: 'Product Hunt 发布',
};

async function generateOne(
  brand: { id: string; name: string; category: string | null; description: string | null; competitors: string[] },
  type: string,
  hint: string
): Promise<{ title: string; body: string }> {
  const sys = TYPE_PROMPTS[type]?.(brand, hint) ?? `为 ${brand.name} 写一段简短介绍。`;
  const body = await chatCompletion(
    [
      { role: 'system', content: sys },
      { role: 'user', content: hint.trim() || '请开始生成' },
    ],
    { maxTokens: 1400, temperature: 0.75 }
  );
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.slice(0, 120) ?? `${brand.name} ${TYPE_TO_TITLE_HINT[type] ?? '内容草案'}`;
  return { title, body };
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
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '参数错误' },
      { status: 400 }
    );
  }

  const brand = await prisma.brand.findFirst({ where: { id: parsed.data.brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const plan = (user?.plan ?? 'FREE') as keyof typeof PLAN_LIMITS;
  const limit = PLAN_LIMITS[plan].contentPieces;
  if (limit === 0) {
    return NextResponse.json({ error: '免费用户暂不支持 AI 内容生成，请升级套餐' }, { status: 403 });
  }
  if (limit !== -1) {
    const current = await prisma.contentPiece.count({ where: { userId } });
    const need = parsed.data.types.length * (parsed.data.count ?? 1);
    if (current + need > limit) {
      return NextResponse.json(
        { error: `批量将生成 ${need} 篇，但当前套餐只允许 ${limit} 篇，请升级套餐或减少数量` },
        { status: 403 }
      );
    }
  }

  const results: { type: string; ok: boolean; contentIds: string[]; error?: string }[] = [];
  const total = parsed.data.count ?? 1;

  for (const type of parsed.data.types) {
    try {
      const generated: { title: string; body: string }[] = [];
      for (let i = 0; i < total; i++) {
        const out = await generateOne(brand, type, parsed.data.promptHint ?? '');
        generated.push(out);
      }
      const createdRows = await prisma.$transaction(
        generated.map((g) =>
          prisma.contentPiece.create({
            data: {
              brandId: brand.id,
              userId,
              type,
              title: g.title,
              body: g.body,
              status: 'draft',
              quality: 70,
              meta: { generatedBy: 'deepseek', batch: true, generatedAt: new Date().toISOString() },
            },
            select: { id: true },
          })
        )
      );
      results.push({ type, ok: true, contentIds: createdRows.map((r) => r.id) });
    } catch (err) {
      results.push({ type, ok: false, contentIds: [], error: err instanceof Error ? err.message : '未知错误' });
    }
  }

  return NextResponse.json({ results, ok: results.every((r) => r.ok) }, { status: 201 });
}
