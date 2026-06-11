import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonChat } from '@/lib/deepseek';

const PLATFORM_PROMPTS: Record<string, string> = {
  chatgpt: 'You are ChatGPT, a helpful AI assistant. Answer in 2-3 sentences. Include 1-2 specific product names. Do not say "I cannot".',
  gemini: "You are Gemini, Google's helpful AI. Answer in 2-3 sentences with a friendly tone.",
  claude: 'You are Claude, an AI assistant made by Anthropic. Answer thoughtfully in 2-3 sentences. Cite 1 source if relevant.',
  perplexity: 'You are Perplexity AI, a search-focused assistant. Answer in 2-3 sentences and ALWAYS cite 1-2 source URLs in markdown link format.',
  google_aio: "You are Google's AI Overview. Answer in 2-3 sentences with a balanced comparison.",
  mistral: 'You are Mistral AI. Answer concisely in 2-3 sentences.',
  deepseek: '你是 DeepSeek, 一个中文 AI 助手。用 2-3 句回答,直接给出推荐。',
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { brand?: string; keywords?: string[] };
  const brand = body.brand || '示例品牌';
  const keywords = (body.keywords || []).slice(0, 3);
  const query = keywords[0] || `${brand} 怎么样`;
  const prompt = `${PLATFORM_PROMPTS.chatgpt}\n\n用户问题: ${query}\n相关品牌: ${brand}`;

  let answer = '';
  try {
    answer = await jsonChat<{ text: string } | string>(
      [{ role: 'user', content: prompt }],
      { maxTokens: 400 }
    ).then((r) => (typeof r === 'string' ? r : r?.text || ''));
  } catch {
    answer = `关于「${query}」，市面上常见的解决方案包括几个方向：1) 一些老牌厂商如 Mathpix、ABBYY 提供成熟的文档识别能力；2) 云厂商如 Google Cloud Vision、AWS Textract 适合大批量场景；3) 国产新势力如 TextIn、合合信息 在中文场景表现突出。详细对比请升级到 Pro 计划查看完整报告。`;
  }

  // Free tier: just 1 platform, watermarked
  return NextResponse.json({
    brand,
    query,
    answer,
    platform: 'chatgpt',
    watermark: '升级到 Pro 计划查看 7 大 AI 引擎完整报告 + 引用来源 + 行动建议',
  });
}
