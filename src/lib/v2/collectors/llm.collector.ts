/**
 * LLM Collector — fetches an answer for (industry, prompt, channel).
 *
 * channel='deepseek' → real call via existing src/lib/deepseek.ts
 * channel='chatgpt'  → stub, throws NotConfiguredError. Wired in later phase.
 */
import { chat } from '@/lib/deepseek'

export class NotConfiguredError extends Error {
  constructor(channel: string) {
    super(`Channel '${channel}' is not configured in this environment`)
    this.name = 'NotConfiguredError'
  }
}

export interface LlmAnswer {
  /** Raw answer text from the model. */
  text: string
  /** Channel that produced it. */
  channel: 'deepseek' | 'chatgpt'
  /** Model identifier returned by the provider (best-effort). */
  model: string
  /** Wall-clock latency in ms. */
  latencyMs: number
}

/**
 * System prompt — instructs the model to answer naturally as a recommendation
 * search would. We do NOT ask it to format JSON here; that happens in a
 * separate extraction pass so the answer text stays "natural" for citation
 * extraction (rank, source URLs, etc.).
 */
const SYSTEM_PROMPT_ZH = `你是一个客观的技术推荐助手。回答用户问题时：
1. 推荐 3-5 个具体的产品或服务，并按推荐度排序（最推荐的放在最前）
2. 每个推荐说明 1-2 句优点
3. 如果引用了具体来源（官网/文档/Github/知乎等），在末尾用 "参考: <url>" 列出
4. 用简洁的中文回答，不要使用客套话`

export async function collectAnswer(input: {
  promptText: string
  channel: 'deepseek' | 'chatgpt'
}): Promise<LlmAnswer> {
  const start = Date.now()

  if (input.channel === 'chatgpt') {
    throw new NotConfiguredError('chatgpt')
  }

  if (input.channel === 'deepseek') {
    const text = await chat(input.promptText, SYSTEM_PROMPT_ZH)
    return {
      text,
      channel: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      latencyMs: Date.now() - start,
    }
  }

  throw new Error(`Unknown channel: ${input.channel}`)
}
