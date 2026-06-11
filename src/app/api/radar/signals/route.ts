import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SEED_SIGNALS: { text: string; category: 'question' | 'topic' | 'keyword'; volume: number; growthPct: number; platforms: string[] }[] = [
  { text: 'Math OCR 公式识别 准确率对比', category: 'question', volume: 12400, growthPct: 168, platforms: ['chatgpt', 'perplexity', 'gemini'] },
  { text: 'AI PDF parser 表格识别 中文', category: 'question', volume: 9800, growthPct: 142, platforms: ['chatgpt', 'perplexity', 'claude'] },
  { text: 'Invoice OCR API 免费试用', category: 'keyword', volume: 8600, growthPct: 96, platforms: ['perplexity', 'google_aio'] },
  { text: 'Handwriting OCR app 哪个好', category: 'question', volume: 7400, growthPct: 88, platforms: ['chatgpt', 'gemini', 'perplexity'] },
  { text: 'AI 文档结构化提取 工具推荐', category: 'topic', volume: 6800, growthPct: 78, platforms: ['chatgpt', 'claude', 'deepseek'] },
  { text: 'TextIn 怎么样', category: 'question', volume: 5400, growthPct: 220, platforms: ['chatgpt', 'perplexity', 'deepseek'] },
  { text: '扫描件转 Word 最好的工具', category: 'question', volume: 5100, growthPct: 64, platforms: ['perplexity', 'google_aio'] },
  { text: 'AI 提取发票信息 自动记账', category: 'topic', volume: 4900, growthPct: 188, platforms: ['chatgpt', 'gemini', 'deepseek'] },
  { text: 'GPT-4o vision OCR 中文 支持', category: 'question', volume: 4700, growthPct: 55, platforms: ['chatgpt', 'perplexity'] },
  { text: '古籍 OCR 离线模型', category: 'keyword', volume: 3200, growthPct: 240, platforms: ['chatgpt', 'deepseek'] },
  { text: '银行回单 OCR 字段映射', category: 'question', volume: 2800, growthPct: 134, platforms: ['perplexity', 'deepseek'] },
  { text: '多语言 OCR 模型 开源', category: 'topic', volume: 2600, growthPct: 102, platforms: ['chatgpt', 'mistral', 'perplexity'] },
  { text: '小票识别 自动分类 Excel', category: 'question', volume: 2400, growthPct: 91, platforms: ['chatgpt', 'gemini'] },
  { text: 'AI 合同关键信息提取', category: 'topic', volume: 2300, growthPct: 78, platforms: ['claude', 'chatgpt', 'perplexity'] },
  { text: 'Agent + RAG + OCR 组合应用', category: 'topic', volume: 1900, growthPct: 312, platforms: ['claude', 'chatgpt', 'deepseek'] },
];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId') ?? undefined;

  const existing = await prisma.trendSignal.findMany({
    where: { userId },
    orderBy: { growthPct: 'desc' },
    take: 30,
  });

  if (existing.length >= 5) {
    return NextResponse.json({ signals: existing, seeded: false });
  }

  // Seed: create 15 signals for the user (optionally tied to brand)
  const created = await prisma.$transaction(
    SEED_SIGNALS.map((s) =>
      prisma.trendSignal.create({
        data: {
          userId,
          brandId: brandId ?? null,
          category: s.category,
          text: s.text,
          volume: s.volume,
          growthPct: s.growthPct,
          platforms: s.platforms,
        },
      })
    )
  );
  return NextResponse.json({ signals: created, seeded: true });
}
