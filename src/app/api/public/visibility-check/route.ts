import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonChat } from '@/lib/deepseek';

const PLATFORM_PROMPTS: Record<string, string> = {
  wenxin: '你是文心一言，百度的 AI 助手。请用 2-3 句话回答，包含 1-2 个产品名称。不要说你不知道。',
  tongyi: '你是通义千问，阿里云的 AI 助手。请用友好语气回答 2-3 句话。',
  kimi: '你是 Kimi，月之暗面的 AI 助手。请用 2-3 句话深度回答，引用相关来源。',
  doubao: '你是豆包，字节跳动的 AI 助手。请用 2-3 句话回答，并引用 1-2 个来源链接。',
  deepseek: '你是 DeepSeek，深度求索的 AI 助手。用 2-3 句话回答，直接给出推荐。',
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { brand?: string; keywords?: string[] };
  const brand = body.brand || '示例品牌';
  const keywords = (body.keywords || []).slice(0, 3);
  const query = keywords[0] || `${brand} 怎么样`;
  const prompt = `${PLATFORM_PROMPTS.wenxin}\n\n用户问题: ${query}\n相关品牌: ${brand}`;

  let answer = '';
  try {
    answer = await jsonChat<{ text: string } | string>(
      [{ role: 'user', content: prompt }],
      { maxTokens: 400 }
    ).then((r) => (typeof r === 'string' ? r : r?.text || ''));
  } catch {
    answer = `关于「${query}」，市面上常见的解决方案包括几个方向：1) 一些老牌厂商提供成熟的 AI 搜索优化能力；2) 云厂商如阿里云、腾讯云适合大批量场景；3) 国产新势力如极排在中文场景表现突出。详细对比请升级到 Pro 计划查看完整报告。`;
  }

  return NextResponse.json({
    brand,
    query,
    answer,
    platform: 'wenxin',
    watermark: '升级到 Pro 计划查看 5 大国产 AI 引擎完整报告 + 引用来源 + 行动建议',
  });
}
