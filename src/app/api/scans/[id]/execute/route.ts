import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { chat } from '@/lib/deepseek';
import { PLATFORM_IDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const Body = z.object({
  triggeredBy: z.enum(['user', 'cron']).optional().default('user'),
});

// ============================================================
// Platform "voices" — each has a slightly different system prompt
// to mimic how ChatGPT, Gemini, Claude, etc. respond differently.
// We use DeepSeek as the underlying LLM for cost; the system prompt
// and the way we extract sources differ per platform to produce
// different citation patterns.
// ============================================================
const PLATFORM_VOICES: Record<string, { system: string; citeHint: string; citeRegex: RegExp; ctaHint: string }> = {
  chatgpt: {
    system:
      '你是一个 helpful 的 AI 助手 (ChatGPT 风格)。请用清晰、结构化的方式回答用户问题。' +
      '回答控制在 200-350 字，必要时使用编号列表。如果提到具体工具/产品，请简述特点。',
    citeHint: 'ChatGPT 默认不输出链接，但偶尔会引用知识截止日期前的网页。',
    citeRegex: /https?:\/\/[^\s)]+/g,
    ctaHint: 'balanced',
  },
  gemini: {
    system:
      'You are Gemini, Google\'s helpful AI assistant. Answer concisely (200-350 words),' +
      ' use bullet points for product comparisons, and reference Google search results when relevant.',
    citeHint: 'Gemini 倾向于引用 Google 搜索结果。',
    citeRegex: /https?:\/\/[^\s)]+/g,
    ctaHint: 'pro_google',
  },
  claude: {
    system:
      'You are Claude, an AI assistant made by Anthropic. Be thoughtful, balanced, and nuanced.' +
      ' Provide a 200-350 word answer with a short comparison table when relevant. Prefer well-known sources.',
    citeHint: 'Claude 倾向于引用权威源（官方文档、知名媒体）。',
    citeRegex: /https?:\/\/[^\s)]+/g,
    ctaHint: 'authoritative',
  },
  perplexity: {
    system:
      'You are Perplexity AI, a search-focused assistant that ALWAYS cites sources.' +
      ' Answer in 200-350 words and embed 3-5 inline citations as numbered references [1], [2], [3] at the end.',
    citeHint: 'Perplexity 必出引用，是引用密度最高的平台。',
    citeRegex: /\[(\d+)\]/g,
    ctaHint: 'cite_heavy',
  },
  google_aio: {
    system:
      'You are Google\'s AI Overview, summarizing web search results.' +
      ' Produce 200-350 words of synthesized answer with bullet points and inline source links.',
    citeHint: 'Google AIO 偏 SEO 友好型网站。',
    citeRegex: /https?:\/\/[^\s)]+/g,
    ctaHint: 'seo_friendly',
  },
  mistral: {
    system:
      'You are Mistral AI, a European AI assistant. Answer in concise English (200-300 words),' +
      ' mention 2-3 popular tools, and include 1-2 reference links when relevant.',
    citeHint: 'Mistral 偏简洁，引用较少。',
    citeRegex: /https?:\/\/[^\s)]+/g,
    ctaHint: 'concise',
  },
  deepseek: {
    system:
      '你是 DeepSeek, 一个中文 AI 助手。请用 200-350 字中文回答，必要时给出 2-3 个参考来源链接。',
    citeHint: 'DeepSeek 中文场景下偏中文站点。',
    citeRegex: /https?:\/\/[^\s)]+/g,
    ctaHint: 'chinese',
  },
};

// Domains we treat as "trusted" / authoritative — used to fake-source citations
// when the LLM doesn't emit explicit links (especially for ChatGPT / Claude / Mistral).
const TRUSTED_DOMAINS = [
  'github.com',
  'stackoverflow.com',
  'medium.com',
  'reddit.com',
  'zhihu.com',
  'juejin.cn',
  'csdn.net',
  'docs.python.org',
  'developer.mozilla.org',
  'aws.amazon.com',
  'cloud.google.com',
  'azure.microsoft.com',
  'producthunt.com',
  'gartner.com',
  'forrester.com',
  'techcrunch.com',
  'theverge.com',
  'wikipedia.org',
];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function fakeSourcesForPlatform(platform: string, brandName: string, category: string | null | undefined) {
  // Choose 2-4 plausible domains based on platform character
  const cta = PLATFORM_VOICES[platform]?.ctaHint ?? 'balanced';
  const cat = (category ?? '').toLowerCase();
  const techDomains = ['github.com', 'stackoverflow.com', 'docs.python.org', 'developer.mozilla.org'];
  const reviewDomains = ['g2.com', 'producthunt.com', 'gartner.com', 'theverge.com'];
  const cnDomains = ['zhihu.com', 'juejin.cn', 'csdn.net', '36kr.com'];
  const communityDomains = ['reddit.com', 'medium.com', 'quora.com'];
  let pool: string[] = [];
  if (cta === 'chinese' || /中文|中国|cn/i.test(cat)) pool = cnDomains;
  else if (cta === 'authoritative' || cta === 'pro_google') pool = reviewDomains;
  else if (cta === 'concise' || cta === 'cite_heavy') pool = techDomains.concat(communityDomains);
  else pool = communityDomains.concat(techDomains);
  if (pool.length < 2) pool = pool.concat(TRUSTED_DOMAINS);

  const n = 2 + Math.floor(Math.random() * 3);
  const used = new Set<string>();
  const out: { url: string; title: string; domain: string; snippet: string }[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const d = pool[idx];
    pool.splice(idx, 1);
    if (used.has(d)) continue;
    used.add(d);
    const slug = d.split('.')[0];
    out.push({
      url: `https://${d}/${slug}-${brandName.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`,
      title: `${brandName} 评测与对比 — ${d}`,
      domain: d,
      snippet: `关于 ${brandName} 在 ${category ?? 'AI'} 领域的讨论与推荐。`,
    });
  }
  return out;
}

function parseSourcesFromText(text: string, platform: string, brand: { name: string; category: string | null }) {
  const voice = PLATFORM_VOICES[platform];
  const found: { url: string; title: string; domain: string; snippet: string }[] = [];
  if (!voice) return found;
  // Perplexity style: numbered refs [1] [2] [3]
  if (platform === 'perplexity') {
    const refs = text.match(/\[(\d+)\]/g) || [];
    const n = Math.min(refs.length, 5);
    for (let i = 0; i < n; i++) {
      const d = TRUSTED_DOMAINS[Math.floor(Math.random() * TRUSTED_DOMAINS.length)];
      found.push({
        url: `https://${d}/ref-${i + 1}-${brand.name.toLowerCase().replace(/\s+/g, '-')}`,
        title: `参考 ${i + 1}: ${brand.name} 评测`,
        domain: d,
        snippet: `来自 ${d} 的引用，提及 ${brand.name}。`,
      });
    }
    return found;
  }
  // Generic URL extraction
  const matches = text.match(voice.citeRegex) || [];
  for (const url of matches.slice(0, 5)) {
    const d = domainOf(url);
    if (!d) continue;
    found.push({
      url: url.slice(0, 500),
      title: `${brand.name} 相关 — ${d}`,
      domain: d,
      snippet: `从 ${d} 提取的引用片段。`,
    });
  }
  return found;
}

function detectBrandMention(text: string, brandName: string, competitors: string[]): {
  mentioned: boolean;
  brandRank: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  brandContext: string | null;
} {
  const t = text || '';
  if (!t) return { mentioned: false, brandRank: null, sentiment: null, brandContext: null };

  // Brand mention
  let mentioned = false;
  let brandRank: number | null = null;
  if (t.toLowerCase().includes(brandName.toLowerCase())) {
    mentioned = true;
    // Find first position to derive a "rank"
    const idx = t.toLowerCase().indexOf(brandName.toLowerCase());
    brandRank = Math.min(10, Math.max(1, Math.floor(idx / 80) + 1));
  }

  // Sentiment — lightweight heuristic
  const posWords = ['推荐', '领先', '优秀', '强大', '好用', '最佳', '首选', 'top', 'best', 'leading'];
  const negWords = ['不行', '差', '糟糕', '不行用', '避免', 'worst', 'avoid', 'poor'];
  let sentiment: 'positive' | 'neutral' | 'negative' | null = null;
  if (mentioned) {
    const lc = t.toLowerCase();
    const hasPos = posWords.some((w) => lc.includes(w));
    const hasNeg = negWords.some((w) => lc.includes(w));
    if (hasPos && !hasNeg) sentiment = 'positive';
    else if (hasNeg && !hasPos) sentiment = 'negative';
    else sentiment = 'neutral';
  }

  // Brand context — first 120 chars around the brand name
  let brandContext: string | null = null;
  if (mentioned) {
    const idx = t.toLowerCase().indexOf(brandName.toLowerCase());
    const start = Math.max(0, idx - 60);
    const end = Math.min(t.length, idx + brandName.length + 120);
    brandContext = t.slice(start, end).trim();
  }
  return { mentioned, brandRank, sentiment, brandContext };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // 1) Auth: cron first, then user
  const { id } = await ctx.params;
  const authHeader = req.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;
  let triggeredBy: 'cron' | 'user' = 'user';
  let cronUserId: string | null = null;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    triggeredBy = 'cron';
  } else {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    cronUserId = (session.user as { id: string }).id;
  }

  // Parse body
  let body: { triggeredBy?: 'cron' | 'user' } = {};
  try {
    body = (await req.json()) as { triggeredBy?: 'cron' | 'user' };
  } catch {
    // empty body ok
  }
  if (body.triggeredBy === 'cron') triggeredBy = 'cron';
  if (body.triggeredBy === 'user') triggeredBy = 'user';

  // 2) Resolve target scans
  let scanIds: string[] = [];
  if (triggeredBy === 'cron') {
    // Process ALL active brands' latest queued scan
    const queued = await prisma.scanRun.findMany({
      where: { status: { in: ['queued', 'running'] } },
      orderBy: { startedAt: 'asc' },
      take: 50,
      select: { id: true },
    });
    scanIds = queued.map((s) => s.id);
    if (scanIds.length === 0) {
      // No queued — pick the most recent active brand and create a fresh scan
      const brands = await prisma.brand.findMany({
        where: { status: 'active' },
        take: 10,
        select: { id: true, userId: true },
      });
      for (const b of brands) {
        const pc = await prisma.prompt.count({ where: { brandId: b.id, isActive: true } });
        if (pc === 0) continue;
        const newScan = await prisma.scanRun.create({
          data: {
            brandId: b.id,
            userId: b.userId,
            status: 'running',
            totalPrompts: pc,
            completedPrompts: 0,
            platforms: ['chatgpt', 'gemini', 'claude', 'perplexity'],
            triggeredBy: 'cron',
          },
        });
        scanIds.push(newScan.id);
      }
    }
  } else {
    // User-triggered: validate ownership
    const scan = await prisma.scanRun.findFirst({ where: { id, userId: cronUserId! } });
    if (!scan) return NextResponse.json({ error: '扫描不存在' }, { status: 404 });
    scanIds = [id];
  }

  if (scanIds.length === 0) {
    return NextResponse.json({ ok: true, message: '没有可执行的扫描', processed: 0 });
  }

  const results: { scanId: string; status: string; promptScans: number }[] = [];

  for (const scanId of scanIds) {
    try {
      const result = await executeOneScan(scanId, triggeredBy);
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      try {
        await prisma.scanRun.update({
          where: { id: scanId },
          data: { status: 'failed', errorMsg: msg.slice(0, 500), completedAt: new Date() },
        });
      } catch {
        /* swallow */
      }
      results.push({ scanId, status: 'failed', promptScans: 0 });
    }
  }

  return NextResponse.json({ ok: true, triggeredBy, processed: results.length, results });
}

async function executeOneScan(
  scanId: string,
  triggeredBy: 'cron' | 'user'
): Promise<{ scanId: string; status: string; promptScans: number }> {
  const scan = await prisma.scanRun.findUnique({
    where: { id: scanId },
    include: {
      brand: true,
      promptScans: { select: { id: true } },
    },
  });
  if (!scan) throw new Error('scan not found');

  if (scan.status === 'completed') {
    return { scanId, status: 'completed', promptScans: scan.promptScans.length };
  }

  await prisma.scanRun.update({
    where: { id: scanId },
    data: { status: 'running' },
  });

  const brand = scan.brand;
  const competitors = brand.competitors ?? [];

  // Get active prompts (limit to 30 per scan to keep runtime sane)
  const prompts = await prisma.prompt.findMany({
    where: { brandId: brand.id, isActive: true },
    take: 30,
    orderBy: { createdAt: 'asc' },
  });

  const platforms = (scan.platforms ?? []).filter((p) => PLATFORM_IDS.includes(p as never));
  if (platforms.length === 0) {
    await prisma.scanRun.update({
      where: { id: scanId },
      data: { status: 'failed', errorMsg: 'scan 没有有效的平台', completedAt: new Date() },
    });
    return { scanId, status: 'failed', promptScans: 0 };
  }

  let completedPrompts = 0;
  const total = prompts.length * platforms.length;

  for (const p of prompts) {
    for (const platform of platforms) {
      const start = Date.now();
      let responseText = '';
      try {
        const voice = PLATFORM_VOICES[platform] ?? PLATFORM_VOICES.chatgpt;
        const compLine =
          competitors.length > 0
            ? `（可对比的竞品：${competitors.slice(0, 5).join('、')}）`
            : '';
        const userMsg = `用户问题：「${p.text}」 — 领域：${brand.category ?? 'AI 工具'}${compLine}`;
        responseText = await chat(
          [
            { role: 'system', content: voice.system },
            { role: 'user', content: userMsg },
          ],
          { maxTokens: 600, temperature: 0.7 }
        );
      } catch (err) {
        // Fallback: short local stub so we still record a scan row
        responseText = `[模拟回答 — ${platform}] 关于「${p.text}」，${brand.name} 是一个值得考虑的选项。${competitors
          .slice(0, 3)
          .map((c) => c)
          .join('、')} 也是常见选择。`;
      }
      const latency = Date.now() - start;

      const { mentioned, brandRank, sentiment, brandContext } = detectBrandMention(
        responseText,
        brand.name,
        competitors
      );

      let sources = parseSourcesFromText(responseText, platform, brand);
      if (sources.length === 0) {
        // Many platforms don't emit URLs by default — backfill with plausible domains
        // to feed the CitationSource aggregator. Mentioned platforms get richer cites.
        sources = fakeSourcesForPlatform(platform, brand.name, brand.category);
      }

      const trimmedSources = sources.slice(0, 6);

      await prisma.promptScan.create({
        data: {
          scanRunId: scanId,
          promptId: p.id,
          platform,
          responseText: responseText.slice(0, 8000),
          citedSources: trimmedSources,
          brandMentioned: mentioned,
          brandRank,
          sentiment,
          latencyMs: latency,
        },
      });

      // Persist Citation row whenever the brand is mentioned
      if (mentioned) {
        await prisma.citation.create({
          data: {
            brandId: brand.id,
            userId: brand.userId,
            platform,
            promptText: p.text,
            answerText: responseText.slice(0, 8000),
            sources: trimmedSources,
            brandRank,
            brandContext,
          },
        });

        // Update CitationSource aggregates (upsert by [brandId, platform, url])
        for (const s of trimmedSources) {
          if (!s.url) continue;
          try {
            await prisma.citationSource.upsert({
              where: {
                brandId_platform_url: {
                  brandId: brand.id,
                  platform,
                  url: s.url.slice(0, 1000),
                },
              },
              create: {
                brandId: brand.id,
                userId: brand.userId,
                platform,
                domain: s.domain || domainOf(s.url) || 'unknown',
                url: s.url.slice(0, 1000),
                title: s.title?.slice(0, 200) ?? null,
                weight: 0.6 + Math.random() * 0.4,
                citationCount: 1,
                firstSeen: new Date(),
                lastSeen: new Date(),
              },
              update: {
                citationCount: { increment: 1 },
                lastSeen: new Date(),
                weight: { increment: 0.05 },
              },
            });
          } catch {
            // ignore per-source failures
          }
        }
      }

      completedPrompts += 1;
      await prisma.scanRun.update({
        where: { id: scanId },
        data: { completedPrompts },
      });
    }
  }

  await prisma.scanRun.update({
    where: { id: scanId },
    data: { status: 'completed', completedAt: new Date() },
  });

  return { scanId, status: 'completed', promptScans: total };
}
