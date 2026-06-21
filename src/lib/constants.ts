// ============================================
// GeoScore — AI 平台常量
// 覆盖国内 7 大 + 海外 5 大 AI 引擎
// ============================================

export const AI_PLATFORMS = [
  // ── 国内平台 ──
  { id: 'deepseek', name: 'DeepSeek', color: '#5b21b6', icon: '🐳' },
  { id: 'tongyi', name: '通义千问', color: '#ff6a00', icon: '🔮' },
  { id: 'wenxin', name: '文心一言', color: '#2932e1', icon: '📝' },
  { id: 'zhipu', name: '智谱清言', color: '#00b578', icon: '🧪' },
  { id: 'kimi', name: 'Kimi', color: '#1677ff', icon: '🌙' },
  { id: 'doubao', name: '豆包', color: '#fe2c55', icon: '🫘' },
  { id: 'yuanbao', name: '腾讯元宝', color: '#07c160', icon: '💰' },
  // ── 海外平台 ──
  { id: 'chatgpt', name: 'ChatGPT', color: '#10a37f', icon: '🤖' },
  { id: 'gemini', name: 'Gemini', color: '#4285f4', icon: '💎' },
  { id: 'claude', name: 'Claude', color: '#d97706', icon: '🧠' },
  { id: 'perplexity', name: 'Perplexity', color: '#ec4899', icon: '🔍' },
  { id: 'mistral', name: 'Mistral', color: '#f97316', icon: '🌪️' },
] as const

export const PLATFORM_IDS = AI_PLATFORMS.map((p) => p.id)

export const PROMPT_CATEGORIES = [
  { id: 'recommend', label: '推荐类', desc: '最好的XX有哪些' },
  { id: 'compare', label: '对比类', desc: 'A vs B / A 还是 B' },
  { id: 'review', label: '评测类', desc: 'XX 怎么样 / 好不好用' },
  { id: 'tutorial', label: '教程类', desc: '如何使用 XX' },
  { id: 'alternative', label: '替代类', desc: 'XX 的替代品' },
  { id: 'pricing', label: '价格类', desc: 'XX 多少钱 / 价格' },
] as const

export const CONTENT_TYPES = [
  { id: 'blog', label: '博客文章', desc: '深度内容建立权威' },
  { id: 'faq', label: 'FAQ 页面', desc: '直接命中AI问题' },
  { id: 'schema', label: 'Schema 结构化数据', desc: '帮助AI理解' },
  { id: 'comparison', label: '对比页面', desc: '抢占对比类query' },
  { id: 'pr', label: 'PR 媒体稿', desc: '增加权威引用源' },
  { id: 'reddit', label: 'Reddit 帖子', desc: 'AI最高权重源之一' },
  { id: 'github_readme', label: 'GitHub README', desc: '技术品牌必占' },
  { id: 'product_hunt', label: 'Product Hunt', desc: '评测类触发器' },
] as const

export const PUBLISH_CHANNELS = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'notion', label: 'Notion' },
  { id: 'webflow', label: 'Webflow' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'ghost', label: 'Ghost' },
  { id: 'reddit', label: 'Reddit (r/...)' },
  { id: 'medium', label: 'Medium' },
  { id: 'hashnode', label: 'Hashnode' },
] as const

export const PLAN_LIMITS = {
  FREE: { keywords: 5, prompts: 50, scansPerDay: 1, contentPieces: 0, seats: 1, price: 0, brands: 1 },
  PRO: { keywords: 100, prompts: 5000, scansPerDay: 10, contentPieces: 20, seats: 1, price: 99, brands: 5 },
  GROWTH: { keywords: 500, prompts: 50000, scansPerDay: 50, contentPieces: 200, seats: 3, price: 299, brands: 20 },
  ENTERPRISE: { keywords: -1, prompts: -1, scansPerDay: -1, contentPieces: -1, seats: -1, price: 999, brands: -1 },
} as const

export function getPlatformMeta(id: string) {
  return AI_PLATFORMS.find((p) => p.id === id) || { id, name: id, color: '#888', icon: '○' }
}
