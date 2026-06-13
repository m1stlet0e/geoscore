// ============================================
// DeepSeek API Client
// 用于 AI 分析的 LLM 调用
// ============================================

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletion {
  choices: {
    message: {
      content: string
    }
  }[]
}

/**
 * 调用 DeepSeek API 进行聊天补全
 */
/**
 * 简单聊天接口（返回纯文本）
 */
export async function chat(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const messages: ChatMessage[] = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })
  return chatCompletion(messages)
}
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured')
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: options?.model || DEEPSEEK_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`)
  }

  const data: ChatCompletion = await response.json()
  return data.choices[0]?.message?.content || ''
}

/**
 * 调用 DeepSeek API 并解析 JSON 响应
 */
export async function jsonChat<T = any>(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<T> {
  const content = await chatCompletion(messages, options)

  // 尝试提取 JSON
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
    content.match(/```\s*([\s\S]*?)\s*```/) || [null, content]

  const jsonStr = jsonMatch[1] || content

  try {
    return JSON.parse(jsonStr.trim())
  } catch {
    // 如果解析失败，尝试找到第一个 { 或 [
    const start = jsonStr.indexOf('{')
    const arrStart = jsonStr.indexOf('[')
    const actualStart = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart)

    if (actualStart >= 0) {
      return JSON.parse(jsonStr.slice(actualStart))
    }

    throw new Error(`Failed to parse JSON from LLM response: ${content.slice(0, 200)}`)
  }
}

/**
 * 兼容旧版 SDK 风格调用（deepseek.chat.completions.create）
 */
export const deepseek = {
  chat: {
    completions: {
      create: async (options: {
        model?: string
        messages: ChatMessage[]
        temperature?: number
        max_tokens?: number
      }) => {
        const content = await chatCompletion(options.messages, {
          model: options.model,
          temperature: options.temperature,
          maxTokens: options.max_tokens,
        })
        return {
          choices: [{ message: { content } }],
        }
      },
    },
  },
}
