'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, CheckCircle2, XCircle, Globe2, TrendingUp, ShieldCheck, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { AI_PLATFORMS } from '@/lib/constants';

interface AuditResult {
  platform: string;
  platformName: string;
  icon: string;
  mentioned: boolean;
  sentiment: string | null;
  snippet: string;
  score: number;
}

interface AuditResponse {
  ok: boolean;
  brandName: string;
  query: string;
  results: AuditResult[];
  overallScore: number;
  mentionRate: number;
  error?: string;
}

const PRESET_QUERIES = [
  '推荐一些好用的 AI 工具',
  '有哪些值得信赖的大语言模型',
  '最好的开源 AI 框架有哪些',
  '如何选择 AI 编程助手',
  'AI 写作工具哪个好',
];

export default function HomePage() {
  const [brandName, setBrandName] = useState('');
  const [website, setWebsite] = useState('');
  const [query, setQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    AI_PLATFORMS.map((p) => p.id)
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim() || !query.trim()) {
      setError('请填写品牌名和查询问题');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError('请至少选择一个 AI 平台');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/public/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: brandName.trim(),
          website: website.trim() || undefined,
          query: query.trim(),
          platforms: selectedPlatforms,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '审计失败');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="md" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-600 md:flex">
            <a href="#features" className="transition hover:text-neutral-900">功能</a>
            <a href="#platforms" className="transition hover:text-neutral-900">AI 引擎</a>
            <Link href="/pricing" className="transition hover:text-neutral-900">价格</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-medium text-neutral-700 transition hover:text-neutral-900 sm:inline-flex">
              登录
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              免费开始 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ===================== Hero: Audit Tool ===================== */}
      <section className="relative pt-16 pb-12 sm:pt-24 sm:pb-16">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4">
          <div className="absolute inset-0 rounded-full bg-indigo-500/[0.07] blur-[100px]" />
          <div className="absolute left-1/4 top-1/3 h-64 w-64 rounded-full bg-violet-500/[0.05] blur-[80px]" />
        </div>

        <div className="mx-auto max-w-3xl px-5 text-center sm:px-6">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
            </span>
            免费审计 · 无需注册 · 30 秒出结果
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl" style={{ letterSpacing: '-0.02em' }}>
            你的品牌在 AI 搜索中
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-500 bg-clip-text text-transparent">
              被提及了吗？
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-500">
            输入品牌名和查询问题，一键扫描 7 大国内 AI 平台，看看 AI 怎么评价你。
          </p>
        </div>

        {/* Audit Form */}
        <div className="mx-auto mt-10 max-w-2xl px-5 sm:px-6">
          <form onSubmit={handleAudit} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-200/50 sm:p-8">
            <div className="space-y-4">
              {/* Brand Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">品牌名称 *</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="例如：Nous Research、百度、字节跳动"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Website */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">官网域名（可选）</label>
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="例如：nousresearch.com"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Query */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">查询问题 *</label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="例如：推荐一些好用的 AI 工具"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESET_QUERIES.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuery(q)}
                      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Selection - Collapsed by default */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
                >
                  <Globe2 className="h-4 w-4" />
                  选择 AI 平台（{selectedPlatforms.length} 个已选）
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {AI_PLATFORMS.map((p) => (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition ${
                          selectedPlatforms.includes(p.id)
                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPlatforms.includes(p.id)}
                          onChange={() => togglePlatform(p.id)}
                          className="h-3.5 w-3.5 rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500"
                        />
                        <span>{p.icon}</span>
                        <span className="font-medium">{p.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    正在扫描 {selectedPlatforms.length} 个 AI 平台...
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    免费审计 — 看 AI 怎么评价你
                  </>
                )}
              </button>

              <p className="text-center text-xs text-neutral-400">
                完全免费 · 无需注册 · 结果即时呈现
              </p>
            </div>
          </form>
        </div>
      </section>

      {/* ===================== Results ===================== */}
      {result && (
        <section className="pb-16">
          <div className="mx-auto max-w-4xl px-5 sm:px-6">
            {/* Overall Score */}
            <div className="mb-8 rounded-2xl border border-neutral-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-8 text-center">
              <div className="text-sm font-semibold uppercase tracking-wider text-indigo-600">AI 可见性评分</div>
              <div className="mt-3 text-7xl font-bold tracking-tight text-neutral-900">
                {result.overallScore}
                <span className="text-3xl text-neutral-400">/100</span>
              </div>
              <div className="mt-2 text-lg text-neutral-600">
                在 <strong>{result.results.length}</strong> 个平台中，
                <strong>{Math.round(result.mentionRate * 100)}%</strong> 提到了「{result.brandName}」
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                {result.overallScore >= 70 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> 表现优秀
                  </span>
                ) : result.overallScore >= 40 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-700">
                    <TrendingUp className="h-4 w-4" /> 有提升空间
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-4 py-1.5 text-sm font-medium text-red-700">
                    <XCircle className="h-4 w-4" /> 需要优化
                  </span>
                )}
              </div>
            </div>

            {/* Per-Platform Results */}
            <div className="space-y-3">
              {result.results.map((r) => {
                const platform = AI_PLATFORMS.find((p) => p.id === r.platform);
                return (
                  <div
                    key={r.platform}
                    className={`rounded-xl border p-5 transition ${
                      r.mentioned
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                          style={{ background: `${platform?.color || '#888'}14`, color: platform?.color || '#888' }}
                        >
                          {platform?.icon || '○'}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-neutral-900">{r.platformName}</div>
                          <div className="text-sm text-neutral-500">
                            {r.mentioned ? '✅ 品牌被提及' : '❌ 品牌未被提及'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-neutral-900">{r.score}</div>
                        <div className="text-xs text-neutral-400">分</div>
                      </div>
                    </div>

                    {r.snippet && (
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm leading-relaxed text-neutral-600 border border-neutral-100">
                        &ldquo;{r.snippet}&rdquo;
                      </div>
                    )}

                    {r.sentiment && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700' :
                          r.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                          'bg-neutral-100 text-neutral-600'
                        }`}>
                          {r.sentiment === 'positive' ? '正面' : r.sentiment === 'negative' ? '负面' : '中性'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* CTA after results */}
            <div className="mt-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-center text-white">
              <h3 className="text-2xl font-bold">想持续监控 + 自动优化？</h3>
              <p className="mt-2 text-indigo-100">
                注册免费账号，获得每日自动扫描、缺口分析、AI 内容生成等完整功能。
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                >
                  免费注册 <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-3.5 text-base font-medium text-white transition hover:bg-white/10"
                >
                  查看完整功能
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================== Features (compact) ===================== */}
      <section id="features" className="border-t border-neutral-200 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-indigo-600">完整功能</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl" style={{ letterSpacing: '-0.02em' }}>
              从审计到优化，一套搞定
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '🔍', title: 'AI 监控', desc: '7 大国内 AI 平台实时扫描' },
              { icon: '📊', title: '引用分析', desc: '逐条 AI 答案溯源分析' },
              { icon: '🎯', title: '缺口分析', desc: '自动识别内容缺失并给建议' },
              { icon: '✨', title: '内容生成', desc: 'AI 自动生成优化内容' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-3 text-base font-semibold text-neutral-900">{f.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== AI Platforms ===================== */}
      <section id="platforms" className="border-t border-neutral-200 bg-neutral-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-indigo-600">覆盖平台</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900">
              7 大国内 AI 平台
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {AI_PLATFORMS.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-5 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl text-lg" style={{ background: `${p.color}14`, color: p.color }}>
                  {p.icon}
                </div>
                <div className="text-sm font-medium text-neutral-800">{p.name}</div>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" /> 已接入
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== Trust ===================== */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-5 sm:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: <ShieldCheck className="h-5 w-5 text-emerald-500" />, label: '数据加密存储' },
              { icon: <Zap className="h-5 w-5 text-amber-500" />, label: '30 秒出结果' },
              { icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />, label: '免费版永久可用' },
              { icon: <Globe2 className="h-5 w-5 text-violet-500" />, label: '7×24 自动监控' },
            ].map((t) => (
              <div key={t.label} className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white p-5 text-center">
                {t.icon}
                <span className="text-sm font-medium text-neutral-700">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-12">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div>
              <Logo size="md" />
              <p className="mt-2 text-sm text-neutral-500">AI 时代的品牌可观测性</p>
            </div>
            <div className="flex gap-6 text-sm text-neutral-500">
              <Link href="/pricing" className="hover:text-neutral-900">价格</Link>
              <Link href="/login" className="hover:text-neutral-900">登录</Link>
              <Link href="/register" className="hover:text-neutral-900">注册</Link>
              <a href="mailto:hello@geoscore.ai" className="hover:text-neutral-900">联系</a>
            </div>
            <div className="text-xs text-neutral-400">
              © {new Date().getFullYear()} GeoScore. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
