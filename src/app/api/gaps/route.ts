import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { jsonChat } from '@/lib/deepseek';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');
  if (!brandId) return NextResponse.json({ error: '缺少 brandId' }, { status: 400 });

  const brand = await prisma.brand.findFirst({ where: { id: brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });

  const competitors = (brand.competitors ?? []).slice(0, 10);
  if (competitors.length === 0) {
    return NextResponse.json({ gaps: [], message: '该品牌暂未配置竞品，无法做差距分析' });
  }

  // Gather recent citations
  const citations = await prisma.citation.findMany({
    where: { brandId, userId },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  // Identify candidate gaps: prompts where the brand was NOT mentioned but at least
  // one competitor was mentioned in the answer text.
  type GapCandidate = {
    promptText: string;
    platform: string;
    missingBrands: string[];
    occurrence: number;
  };

  const candidateMap = new Map<string, GapCandidate>();
  const lcBrand = brand.name.toLowerCase();

  for (const c of citations) {
    const text = `${c.answerText ?? ''} ${c.promptText ?? ''}`;
    const lc = text.toLowerCase();
    const brandHit = lc.includes(lcBrand);
    if (brandHit) continue; // not a gap
    const missing: string[] = [];
    for (const comp of competitors) {
      if (lc.includes(comp.toLowerCase())) missing.push(comp);
    }
    if (missing.length === 0) continue;
    const key = `${c.platform}::${c.promptText}`;
    const cur = candidateMap.get(key);
    if (cur) {
      cur.occurrence += 1;
      for (const m of missing) if (!cur.missingBrands.includes(m)) cur.missingBrands.push(m);
    } else {
      candidateMap.set(key, {
        promptText: c.promptText,
        platform: c.platform,
        missingBrands: missing,
        occurrence: 1,
      });
    }
  }

  // If we have no candidates, look at prompts directly (broader recall)
  if (candidateMap.size === 0) {
    const prompts = await prisma.prompt.findMany({
      where: { brandId, userId, isActive: true },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });
    for (const p of prompts) {
      const lc = p.text.toLowerCase();
      const missing = competitors.filter((c) => lc.includes(c.toLowerCase()));
      if (missing.length === 0) continue;
      candidateMap.set(`pending::${p.id}`, {
        promptText: p.text,
        platform: 'chatgpt',
        missingBrands: missing,
        occurrence: 0,
      });
    }
  }

  const candidates = Array.from(candidateMap.values())
    .sort((a, b) => b.occurrence - a.occurrence)
    .slice(0, 10);

  // For each candidate, ask LLM for suggested actions
  const gaps: {
    id: string;
    promptText: string;
    platform: string;
    missingBrands: string[];
    suggestedActions: string[];
    priority: 'high' | 'medium' | 'low';
  }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    let actions: string[] = [];
    try {
      const sys = `你是一个 GEO 优化专家。给定一个 AI 搜索 prompt 和竞品回答，输出 2-3 条可执行的中文建议（每条 15-50 字），帮助品牌「${brand.name}」出现在该回答中。返回 JSON {"suggestions":["...", "..."]}。`;
      const out = await jsonChat<{ suggestions: string[] }>(
        [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: `prompt: ${c.promptText}\n竞品被提及: ${c.missingBrands.join('、')}\n所在平台: ${c.platform}\n请给出 2-3 条建议。`,
          },
        ],
        { maxTokens: 350, temperature: 0.7 }
      );
      if (Array.isArray(out?.suggestions)) {
        actions = out.suggestions.filter((s) => typeof s === 'string' && s.length > 5).slice(0, 3);
      }
    } catch {
      // local fallback so the route still returns useful data
      actions = [
        `在「${c.missingBrands[0]}」常被引用的官方文档/对比页面中补充 ${brand.name} 的优势对比。`,
        `产出一篇针对该 prompt 的 FAQ 或对比文章，发布到博客与 Reddit 等高权重平台。`,
        `优化 ${brand.name} 官网结构化数据（schema/Product/SoftwareSourceCode），提升被 AI 引用的概率。`,
      ];
    }

    // priority: more occurrences = higher
    const priority: 'high' | 'medium' | 'low' =
      c.occurrence >= 3 ? 'high' : c.occurrence >= 1 ? 'medium' : 'low';

    gaps.push({
      id: `gap-${i}-${c.platform}`,
      promptText: c.promptText,
      platform: c.platform,
      missingBrands: c.missingBrands,
      suggestedActions: actions,
      priority,
    });
  }

  return NextResponse.json({ gaps, total: gaps.length });
}
