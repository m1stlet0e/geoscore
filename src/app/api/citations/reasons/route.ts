import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ReasonKey = '官方文档' | '社区讨论' | '评测文章' | '代码示例' | '对比页面' | '媒体新闻' | '学术论文';

const REASON_PATTERNS: { key: ReasonKey; patterns: RegExp[] }[] = [
  {
    key: '官方文档',
    patterns: [
      /\bdocs?\./i,
      /官方文档/,
      /official\s+(?:documentation|docs|site)/i,
      /documentation/i,
      /developer\./i,
      /api\s+reference/i,
    ],
  },
  {
    key: '社区讨论',
    patterns: [
      /reddit\.com/i,
      /zhihu\.com/i,
      /quora\.com/i,
      /stackoverflow\.com/i,
      /discord\.gg/i,
      /社区/,
      /讨论/,
      /forum/i,
    ],
  },
  {
    key: '评测文章',
    patterns: [
      /review/i,
      /评测/,
      /测评/,
      /hands[- ]on/i,
      /g2\.com/i,
      /producthunt\.com/i,
      /capterra/i,
    ],
  },
  {
    key: '代码示例',
    patterns: [
      /github\.com/i,
      /githubusercontent/i,
      /snippet/i,
      /code\s+sample/i,
      /代码示例/,
      /github\s+readme/i,
    ],
  },
  {
    key: '对比页面',
    patterns: [
      /对比/,
      /compare/i,
      /vs\.?/i,
      /comparison/i,
      /alternatives?/i,
      /替代/,
    ],
  },
  {
    key: '媒体新闻',
    patterns: [
      /techcrunch/i,
      /theverge/i,
      /36kr\.com/i,
      /forbes/i,
      /bloomberg/i,
      /新华网|人民网|澎湃/,
    ],
  },
  {
    key: '学术论文',
    patterns: [/arxiv\.org/i, /学术论文/, /论文/, /research\s+paper/i, /doi\.org/i],
  },
];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const citations = await prisma.citation.findMany({
    where: { brandId, userId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const counts: Record<ReasonKey, number> = {
    官方文档: 0,
    社区讨论: 0,
    评测文章: 0,
    代码示例: 0,
    对比页面: 0,
    媒体新闻: 0,
    学术论文: 0,
  };

  for (const c of citations) {
    const text = `${c.answerText ?? ''}\n${(c.sources as { url?: string; domain?: string; title?: string }[] | null)
      ?.map((s) => `${s.url ?? ''} ${s.domain ?? ''} ${s.title ?? ''}`)
      .join('\n') ?? ''}`;

    let matched: ReasonKey | null = null;
    for (const r of REASON_PATTERNS) {
      if (r.patterns.some((p) => p.test(text))) {
        matched = r.key;
        break;
      }
    }
    if (matched) counts[matched] += 1;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const reasons = (Object.keys(counts) as ReasonKey[])
    .map((k) => ({
      reason: k,
      count: counts[k],
      pct: total === 0 ? 0 : Math.round((counts[k] / total) * 1000) / 10,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ total, reasons });
}
