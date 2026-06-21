// ============================================
// DeepSeek API Client (OpenAI-compatible SDK)
// 指数退避重试 + 并发控制 + JSON 模式
// ============================================

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { llmConcurrencyPool } from '@/lib/llm/client'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 30_000)

const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1_000

export const deepseekClient = new OpenAI({
  baseURL: DEEPSEEK_BASE_URL,
  apiKey: process.env.DEEPSEEK_API_KEY,
  timeout: LLM_TIMEOUT_MS,
})

function toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429 || error.status >= 500
  }
  if (error instanceof SyntaxError) return true
  if (error instanceof Error) {
    return (
      error.name === 'APIConnectionError' ||
      error.name === 'TimeoutError' ||
      error.message.includes('timeout') ||
      error.message.includes('ETIMEDOUT')
    )
  }
  return false
}

async function createChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  retries = 0
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  try {
    return await llmConcurrencyPool.run(() =>
      deepseekClient.chat.completions.create(params)
    )
  } catch (error) {
    if (isRetryableError(error) && retries < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries)
      console.warn(
        `[DeepSeek API Error] Retrying in ${delay}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`,
        error instanceof Error ? error.message : error
      )
      await sleep(delay)
      return createChatCompletion(params, retries + 1)
    }
    console.error(`[DeepSeek API Fatal] Failed after ${retries} retries:`, error)
    throw error
  }
}

export async function chat(prompt: string, systemPrompt?: string): Promise<string> {
  const messages: ChatMessage[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
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
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured')
  }

  const response = await createChatCompletion({
    model: options?.model || DEEPSEEK_MODEL,
    messages: toOpenAIMessages(messages),
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2000,
  })
  return response.choices[0]?.message?.content || ''
}

function parseJsonFromContent<T>(content: string): T {
  try {
    return JSON.parse(content.trim()) as T
  } catch {
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) ||
      content.match(/```\s*([\s\S]*?)\s*```/) ||
      [null, content]

    const jsonStr = jsonMatch[1] || content
    const start = jsonStr.indexOf('{')
    const arrStart = jsonStr.indexOf('[')
    const actualStart =
      start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart)

    if (actualStart >= 0) {
      return JSON.parse(jsonStr.slice(actualStart)) as T
    }

    throw new SyntaxError(`Failed to parse JSON from LLM response: ${content.slice(0, 200)}`)
  }
}

/**
 * 带重试与 JSON 模式的结构化对话接口
 */
export async function jsonChat<T = unknown>(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  },
  retries = 0
): Promise<T> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured')
  }

  try {
    const response = await createChatCompletion({
      model: options?.model || DEEPSEEK_MODEL,
      messages: toOpenAIMessages(messages),
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 2000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from DeepSeek')
    return parseJsonFromContent<T>(content)
  } catch (error) {
    if (isRetryableError(error) && retries < MAX_RETRIES) {
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries)
      console.warn(
        `[DeepSeek jsonChat] Retrying in ${delay}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`,
        error instanceof Error ? error.message : error
      )
      await sleep(delay)
      return jsonChat<T>(messages, options, retries + 1)
    }
    throw error
  }
}

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
