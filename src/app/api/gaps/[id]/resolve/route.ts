import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { CONTENT_TYPES } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPE_IDS = CONTENT_TYPES.map((c) => c.id) as [string, ...string[]];

const Body = z.object({
  brandId: z.string().min(1),
  promptText: z.string().min(2).max(500),
  platform: z.string().optional().default('wenxin'),
  missingBrands: z.array(z.string()).optional().default([]),
  suggestedActions: z.array(z.string()).optional().default([]),
  contentType: z.enum(TYPE_IDS).optional().default('blog'),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id: _gapId } = await ctx.params;

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

  const title = `针对「${parsed.data.promptText.slice(0, 30)}」的内容补救草案`;
  const body = `## 背景\n\nAI 平台 ${parsed.data.platform} 上的用户提问「${parsed.data.promptText}」中，以下竞品被多次引用：${parsed.data.missingBrands.join('、') || '暂无'}。\n\n## 待执行建议\n\n${(parsed.data.suggestedActions.length > 0 ? parsed.data.suggestedActions : [
  `围绕该 prompt 产出一篇 ${parsed.data.contentType} 类型内容。`,
  `在 ${brand.name} 官网和权威平台同步发布，争取被 ${parsed.data.platform} 引用。`,
]).map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n## 下一步\n\n- 由内容编辑 review 草稿\n- 发布到目标渠道（${parsed.data.contentType}）\n- 一周后回看 AI 引用情况\n`;

  const piece = await prisma.contentPiece.create({
    data: {
      brandId: brand.id,
      userId,
      type: parsed.data.contentType,
      title,
      body,
      status: 'draft',
      meta: {
        source: 'gap',
        gapId: _gapId,
        promptText: parsed.data.promptText,
        platform: parsed.data.platform,
        missingBrands: parsed.data.missingBrands,
        suggestedActions: parsed.data.suggestedActions,
      },
    },
  });

  // Also create an alert so the user is notified
  await prisma.alert.create({
    data: {
      brandId: brand.id,
      userId,
      type: 'gap_opened',
      severity: 'medium',
      title: `已为差距「${parsed.data.promptText.slice(0, 20)}」创建内容草稿`,
      message: `请前往内容中心查看并完善该 ${parsed.data.contentType} 草稿。`,
      meta: { contentId: piece.id, gapId: _gapId },
    },
  });

  return NextResponse.json({ content: piece }, { status: 201 });
}
