const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 1_000

export class ConcurrencyPool {
  private running = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly maxConcurrency: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    this.running++
    try {
      return await fn()
    } finally {
      this.running--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

export const llmConcurrencyPool = new ConcurrencyPool(
  Number(process.env.LLM_MAX_CONCURRENCY || 3)
)

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config?: {
    timeoutMs?: number
    maxRetries?: number
    retryDelayMs?: number
  }
): Promise<Response> {
  const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = config?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs)

      if (response.ok || !isRetryableStatus(response.status) || attempt === maxRetries) {
        return response
      }

      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt === maxRetries) break
    }

    await sleep(retryDelayMs * (attempt + 1))
  }

  throw lastError ?? new Error('Request failed after retries')
}
