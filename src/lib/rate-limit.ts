// ============================================
// 简易内存级 Rate Limiter
// 生产环境建议换 Redis
// ============================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// 每 60 秒清理一次过期条目
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000).unref()

export interface RateLimitConfig {
  maxRequests: number  // 窗口内最大请求数
  windowMs: number     // 时间窗口（毫秒）
}

export function rateLimit(
  key: string,
  config: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 }
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // 新窗口
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetAt - now }
}

// 获取客户端 IP（兼容 Vercel / 代理）
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return '127.0.0.1'
}
