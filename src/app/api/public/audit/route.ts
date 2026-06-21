import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chatCompletion } from '@/lib/deepseek';
import { AI_PLATFORMS } from '@/lib/constants';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const DAILY_AUDIT_LIMIT = Number(process.env.PUBLIC_AUDIT_DAILY_LIMIT || 3);
const BURST_AUDIT_LIMIT = Number(process.env.PUBLIC_AUDIT_BURST_LIMIT || 2);

const Body = z.object({
  brandName: z.string().min(1).max(100),
  website: z.string().optional(),
  query: z.string().min(1).max(500),
  platforms: z.array(z.string()).min(1).max(7),
});

// Platform system prompts for realistic simulation
const PLATFORM_PROMPTS: Record<string, string> = {
  deepseek: '你是 DeepSeek，中文 AI 助手。用 200-300 字中文回答，提到具体工具/产品时说明特点。',
  tongyi: '你是通义千问，阿里巴巴的 AI 助手。用 200-300 字中文回答，结构清晰。',
  wenxin: '你是文心一言，百度的 AI 助手。用 200-300 字中文回答。',
  zhipu: '你是智谱清言，智谱 AI 的助手。用 200-300 字中文回答，偏学术和技术。',
  kimi: '你是 Kimi，月之暗面的 AI 助手。用 200-300 字中文回答，擅长长文本理解。',
  doubao: '你是豆包，字节跳动的 AI 助手。用 200-300 字中文回答，偏实用内容。',
  yuanbao: '你是腾讯元宝，腾讯的 AI 助手。用 200-300 字中文回答。',
};

function detectMention(text: string, brandName: string): { mentioned: boolean; sentiment: string | null; snippet: string } {
  const lower = text.toLowerCase();
  const brandLower = brandName.toLowerCase();
  const mentioned = lower.includes(brandLower);

  let sentiment: string | null = null;
  if (mentioned) {
    const posWords = ['推荐', '优秀', '强大', '好用', '首选', '领先', '值得'];
    const negWords = ['不推荐', '差', '问题', '不足', '缺陷', '避免'];
    const hasPos = posWords.some((w) => lower.includes(w));
    const hasNeg = negWords.some((w) => lower.includes(w));
    if (hasPos && !hasNeg) sentiment = 'positive';
    else if (hasNeg && !hasPos) sentiment = 'negative';
    else sentiment = 'neutral';
  }

  // Extract snippet around brand mention
  let snippet = '';
  if (mentioned) {
    const idx = lower.indexOf(brandLower);
    const start = Math.max(0, idx - 40);
    const end = Math.min(text.length, idx + brandName.length + 80);
    snippet = text.slice(start, end).trim();
  } else {
    // Take first 120 chars as context
    snippet = text.slice(0, 150).trim() + (text.length > 150 ? '...' : '');
  }

  return { mentioned, sentiment, snippet };
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const burst = rateLimit(`public-audit-burst:${ip}`, {
      maxRequests: BURST_AUDIT_LIMIT,
      windowMs: 60_000,
    });
    if (!burst.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(burst.resetIn / 1000)) },
        }
      );
    }

    const daily = rateLimit(`public-audit-daily:${ip}`, {
      maxRequests: DAILY_AUDIT_LIMIT,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!daily.allowed) {
      return NextResponse.json(
        { error: '今日免费审计次数已用完，注册后可获得更多额度' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(daily.resetIn / 1000)) },
        }
      );
    }

    const body = await req.json();
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    const { brandName, website, query, platforms } = parsed.data;

    // Run audits in parallel
    const results = await Promise.all(
      platforms.map(async (platformId) => {
        const platform = AI_PLATFORMS.find((p) => p.id === platformId);
        if (!platform) {
          return {
            platform: platformId,
            platformName: platformId,
            icon: '○',
            mentioned: false,
            sentiment: null,
            snippet: '未知平台',
            score: 0,
          };
        }

        try {
          const systemPrompt = PLATFORM_PROMPTS[platformId] || PLATFORM_PROMPTS.deepseek;
          const userMsg = `用户问题：「${query}」 — 我关注的品牌/产品：${brandName}${website ? ` (${website})` : ''}`;

          const response = await chatCompletion(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMsg },
            ],
            { maxTokens: 600, temperature: 0.7 }
          );

          const { mentioned, sentiment, snippet } = detectMention(response, brandName);

          // Calculate score
          let score = 0;
          if (mentioned) {
            score = 60; // Base for being mentioned
            if (sentiment === 'positive') score += 25;
            else if (sentiment === 'neutral') score += 10;
            // Early mention = higher score
            const idx = response.toLowerCase().indexOf(brandName.toLowerCase());
            if (idx < 100) score += 15;
            else if (idx < 200) score += 10;
          }

          return {
            platform: platformId,
            platformName: platform.name,
            icon: platform.icon,
            mentioned,
            sentiment,
            snippet,
            score: Math.min(100, score),
          };
        } catch {
          return {
            platform: platformId,
            platformName: platform.name,
            icon: platform.icon,
            mentioned: false,
            sentiment: null,
            snippet: '扫描失败，请稍后重试',
            score: 0,
          };
        }
      })
    );

    // Calculate overall score
    const mentionedCount = results.filter((r) => r.mentioned).length;
    const mentionRate = results.length > 0 ? mentionedCount / results.length : 0;
    const avgScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0;

    return NextResponse.json({
      ok: true,
      brandName,
      query,
      results,
      overallScore: avgScore,
      mentionRate,
    });
  } catch (err) {
    console.error('Public audit error:', err);
    return NextResponse.json(
      { error: '审计失败，请稍后重试' },
      { status: 500 }
    );
  }
}
