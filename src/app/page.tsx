'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Globe2, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Sparkles,
  BarChart3,
  Search,
  MessageSquare,
  Lock,
  Cpu,
  Radar,
  Activity,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { AI_PLATFORMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

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
  const { data: session, status } = useSession();
  const isLoggedIn = status === "authenticated" && !!session?.user;
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      
      // Scroll to results
      setTimeout(() => {
        document.getElementById('audit-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fafafa] text-neutral-900 selection:bg-indigo-100 selection:text-indigo-700">
      {/* Nav */}
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
          scrolled 
            ? "bg-white/80 backdrop-blur-md border-neutral-200 py-3" 
            : "bg-transparent border-transparent py-5"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
            <Logo size="lg" />
          </Link>
          <nav className="hidden items-center gap-10 text-sm font-semibold text-neutral-500 md:flex">
            <a href="#features" className="transition hover:text-neutral-900">核心功能</a>
            <a href="#solutions" className="transition hover:text-neutral-900">解决方案</a>
            <Link href="/pricing" className="transition hover:text-neutral-900">定价方案</Link>
          </nav>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/20 transition hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0"
              >
                进入控制台 <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm font-bold text-neutral-700 transition hover:text-neutral-900 sm:inline-flex">
                  登录
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-bold text-white shadow-xl shadow-neutral-900/10 transition hover:bg-neutral-800 hover:-translate-y-0.5 active:translate-y-0"
                >
                  免费开始 <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-48 sm:pb-32">
        {/* Abstract Background Elements */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-violet-500/10 blur-[140px]" />
          <div className="absolute top-[20%] right-[15%] h-[300px] w-[300px] rounded-full bg-blue-400/5 blur-[100px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
        </div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-4 py-1.5 text-xs font-bold tracking-wider text-indigo-600 shadow-sm uppercase">
              <Sparkles className="h-3.5 w-3.5 fill-indigo-600" />
              GEO: AI 时代的 SEO 革命
            </div>
            
            <h1 className="mt-8 max-w-4xl text-5xl font-black leading-[1.05] tracking-tight text-neutral-900 sm:text-7xl lg:text-8xl">
              让你的品牌在 <br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">
                AI 搜索中脱颖而出
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-xl font-medium leading-relaxed text-neutral-500 sm:text-2xl">
              极排 帮助企业监控、分析并优化品牌在 文心一言、Kimi、Kimi 等 AI 引擎中的曝光度与推荐排名。
            </p>

            <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
              <a 
                href="#audit-tool"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-10 text-lg font-black text-white shadow-2xl shadow-indigo-600/20 transition hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0"
              >
                立即免费审计 <Zap className="h-5 w-5 fill-white" />
              </a>
              <Link
                href="/register"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-neutral-200 bg-white px-10 text-lg font-bold text-neutral-900 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                查看演示
              </Link>
            </div>

            <div className="mt-16 flex items-center gap-8 opacity-40 grayscale transition-all hover:opacity-100 hover:grayscale-0">
              <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest">覆盖平台</div>
              <div className="flex gap-6 sm:gap-10">
                {AI_PLATFORMS.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-2xl">{p.icon}</span>
                    <span className="hidden text-sm font-black sm:block">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audit Tool Section */}
      <section id="audit-tool" className="relative py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-white p-8 shadow-2xl shadow-neutral-200/50 sm:p-12 lg:p-16">
            {/* Decorative background for the card */}
            <div className="absolute top-0 right-0 -m-20 h-80 w-80 rounded-full bg-indigo-50/50 blur-3xl" />
            <div className="absolute bottom-0 left-0 -m-20 h-80 w-80 rounded-full bg-violet-50/50 blur-3xl" />

            <div className="relative z-10 grid gap-12 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <h2 className="text-3xl font-black leading-tight text-neutral-900 sm:text-4xl">
                  30 秒获得 <br />
                  <span className="text-indigo-600">AI 品牌审计报告</span>
                </h2>
                <p className="mt-4 text-lg font-medium text-neutral-500">
                  输入你的品牌信息，我们将实时模拟用户提问，分析各大 AI 平台对你的评价。
                </p>
                
                <ul className="mt-8 space-y-4">
                  {[
                    { icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />, text: '实时多平台扫描' },
                    { icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />, text: '情感倾向分析' },
                    { icon: <CheckCircle2 className="h-5 w-5 text-indigo-500" />, text: '可见性量化评分' },
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 font-bold text-neutral-700">
                      {item.icon}
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-3">
                <form onSubmit={handleAudit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-neutral-400">品牌名称</label>
                      <input
                        type="text"
                        required
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="例如：极排"
                        className="w-full rounded-2xl border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-bold outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-neutral-400">官网域名</label>
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="geoscore.ai"
                        className="w-full rounded-2xl border-2 border-neutral-100 bg-neutral-50 px-5 py-4 font-bold outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-neutral-400">测试问题</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="例如：推荐一些好用的 AI 搜索优化工具"
                        className="w-full rounded-2xl border-2 border-neutral-100 bg-neutral-50 px-5 py-4 pl-12 font-bold outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                      />
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {PRESET_QUERIES.slice(0, 3).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuery(q)}
                          className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-xs font-bold text-neutral-500 transition hover:border-indigo-500 hover:text-indigo-600"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400 hover:text-neutral-900"
                    >
                      {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      高级设置: {selectedPlatforms.length} 个平台
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {AI_PLATFORMS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePlatform(p.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border-2 p-3 transition-all",
                              selectedPlatforms.includes(p.id)
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                                : "border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200"
                            )}
                          >
                            <span className="text-lg">{p.icon}</span>
                            <span className="text-xs font-bold">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-600">
                      <XCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-indigo-600 py-5 text-lg font-black text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/30 disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        正在分析中...
                      </>
                    ) : (
                      <>
                        生成我的免费报告
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      {result && (
        <section id="audit-results" className="py-20 bg-white">
          <div className="mx-auto max-w-5xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-neutral-900 sm:text-5xl">审计结果报告</h2>
              <p className="mt-4 text-lg font-medium text-neutral-500">
                针对问题：「{result.query}」
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Overall Score Card */}
              <div className="lg:col-span-1">
                <div className="sticky top-32 rounded-[2.5rem] border border-neutral-100 bg-neutral-50 p-10 text-center">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">总体可见性</div>
                  <div className="mt-6 flex items-baseline justify-center gap-1">
                    <span className="text-8xl font-black tracking-tighter text-neutral-900">{result.overallScore}</span>
                    <span className="text-2xl font-black text-neutral-300">/100</span>
                  </div>
                  
                  <div className="mt-8 flex flex-col items-center gap-4">
                    {result.overallScore >= 70 ? (
                      <div className="rounded-full bg-emerald-100 px-6 py-2 text-sm font-black text-emerald-700">表现优秀</div>
                    ) : result.overallScore >= 40 ? (
                      <div className="rounded-full bg-amber-100 px-6 py-2 text-sm font-black text-amber-700">有待提升</div>
                    ) : (
                      <div className="rounded-full bg-red-100 px-6 py-2 text-sm font-black text-red-700">急需优化</div>
                    )}
                    
                    <p className="text-sm font-medium text-neutral-500">
                      在 {result.results.length} 个测试平台中，有 {Math.round(result.mentionRate * result.results.length)} 个平台提到了你的品牌。
                    </p>
                  </div>

                  <div className="mt-10 pt-8 border-t border-neutral-200">
                    <Link 
                      href="/register"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-4 font-black text-white transition hover:bg-neutral-800"
                    >
                      解锁完整建议 <Lock className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Platform List */}
              <div className="lg:col-span-2 space-y-4">
                {result.results.map((r) => (
                  <div 
                    key={r.platform}
                    className={cn(
                      "group relative overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-xl hover:shadow-neutral-200/30",
                      r.mentioned ? "border-emerald-100 bg-emerald-50/20" : "border-neutral-100 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm border border-neutral-100">
                          {r.icon}
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-neutral-900">{r.platformName}</h3>
                          <div className="flex items-center gap-2">
                            {r.mentioned ? (
                              <span className="flex items-center gap-1 text-xs font-black text-emerald-600 uppercase tracking-widest">
                                <CheckCircle2 className="h-3.5 w-3.5" /> 已提及
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-black text-neutral-400 uppercase tracking-widest">
                                <XCircle className="h-3.5 w-3.5" /> 未提及
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black text-neutral-900">{r.score}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Score</div>
                      </div>
                    </div>

                    {r.snippet && (
                      <div className="mt-6 relative">
                        <div className="absolute -left-2 top-0 text-4xl text-indigo-200 font-serif">“</div>
                        <p className="pl-4 text-sm font-medium leading-relaxed text-neutral-600 italic">
                          {r.snippet}
                        </p>
                      </div>
                    )}

                    {r.sentiment && (
                      <div className="mt-4 flex justify-end">
                        <span className={cn(
                          "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                          r.sentiment === 'positive' ? "bg-emerald-100 text-emerald-700" :
                          r.sentiment === 'negative' ? "bg-red-100 text-red-700" :
                          "bg-neutral-100 text-neutral-600"
                        )}>
                          {r.sentiment === 'positive' ? '正面评价' : r.sentiment === 'negative' ? '负面评价' : '中性评价'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Bento Grid */}
      <section id="features" className="py-24 bg-[#fafafa]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600">核心能力</div>
            <h2 className="mt-4 text-4xl font-black text-neutral-900 sm:text-6xl">全方位的 GEO 优化引擎</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
            {/* Bento Item 1 */}
            <div className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-white p-10 transition-all hover:shadow-2xl hover:shadow-indigo-500/10">
              <div className="absolute top-0 right-0 p-10 opacity-10 transition-transform group-hover:scale-110 group-hover:rotate-12">
                <Radar className="h-32 w-32 text-indigo-600" />
              </div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/20">
                  <Activity className="h-7 w-7" />
                </div>
                <h3 className="mt-8 text-3xl font-black text-neutral-900">实时 AI 监控</h3>
                <p className="mt-4 text-lg font-medium text-neutral-500 max-w-md">
                  7x24 小时自动扫描主流 AI 平台。当你的品牌可见性下降或竞品排名上升时，第一时间获得警报。
                </p>
                <div className="mt-auto pt-10">
                  <div className="flex -space-x-3">
                    {AI_PLATFORMS.map(p => (
                      <div key={p.id} className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-neutral-50 shadow-sm text-xl">
                        {p.icon}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Item 2 */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:shadow-violet-500/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-black text-neutral-900">引用溯源分析</h3>
              <p className="mt-3 text-sm font-medium text-neutral-500">
                深度解析 AI 答案背后的数据源。找出哪些网站、博客或社交帖子在影响 AI 的判断。
              </p>
            </div>

            {/* Bento Item 3 */}
            <div className="group relative overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:shadow-blue-500/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-black text-neutral-900">趋势预测</h3>
              <p className="mt-3 text-sm font-medium text-neutral-500">
                基于历史数据预测未来 30/90 天的品牌可见性趋势，提前布局热门话题。
              </p>
            </div>

            {/* Bento Item 4 */}
            <div className="md:col-span-2 group relative overflow-hidden rounded-[2.5rem] border border-neutral-200 bg-white p-10 transition-all hover:shadow-2xl hover:shadow-emerald-500/10">
              <div className="flex items-start justify-between">
                <div className="max-w-xs">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-2xl font-black text-neutral-900">AI 增长代理</h3>
                  <p className="mt-3 text-sm font-medium text-neutral-500">
                    不只是发现问题。我们的 AI 代理会自动生成优化建议，并一键生成符合 AI 胃口的高质量内容。
                  </p>
                </div>
                <div className="hidden sm:block">
                  <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 space-y-2 w-48">
                    <div className="h-2 w-24 rounded-full bg-neutral-200" />
                    <div className="h-2 w-32 rounded-full bg-indigo-400" />
                    <div className="h-2 w-20 rounded-full bg-neutral-200" />
                    <div className="pt-2 flex justify-end">
                      <div className="h-6 w-12 rounded-lg bg-indigo-600" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <h2 className="text-4xl font-black text-neutral-900 sm:text-6xl leading-tight">
                为什么你需要 <br />
                <span className="text-indigo-600 underline decoration-indigo-600/20 underline-offset-8">GEO</span> 而不仅仅是 SEO？
              </h2>
              <div className="mt-10 space-y-8">
                {[
                  { title: 'AI 正在取代搜索框', desc: '超过 40% 的年轻用户更倾向于在 AI 助手而非传统搜索引擎中寻找答案。' },
                  { title: '引用即是流量', desc: 'AI 的引用来源是极高质量的流量入口，转化率远高于普通搜索结果。' },
                  { title: '算法逻辑完全不同', desc: 'AI 关注的是语义关联、权威证据和社区共识，传统的关键词堆砌已失效。' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-6">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-black text-indigo-600">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-neutral-900">{item.title}</h4>
                      <p className="mt-2 font-medium text-neutral-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:w-1/2 relative">
              <div className="relative z-10 overflow-hidden rounded-[3rem] border border-neutral-200 shadow-2xl">
                <div className="bg-neutral-900 p-4 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                  </div>
                  <div className="mx-auto h-5 w-48 rounded-full bg-white/10" />
                </div>
                <div className="bg-white p-8 sm:p-12">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">G</div>
                    <div className="h-4 w-32 rounded-full bg-neutral-100" />
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 w-full rounded-full bg-neutral-50" />
                    <div className="h-4 w-[90%] rounded-full bg-neutral-50" />
                    <div className="h-4 w-[95%] rounded-full bg-neutral-50" />
                    <div className="pt-4">
                      <div className="inline-block rounded-2xl border-2 border-indigo-500 bg-indigo-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                          <span className="text-sm font-black text-indigo-900">极排 推荐</span>
                        </div>
                        <div className="h-3 w-32 rounded-full bg-indigo-200" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating stats */}
              <div className="absolute -right-8 top-1/4 z-20 rounded-2xl bg-white p-6 shadow-2xl border border-neutral-100 hidden sm:block animate-bounce-slow">
                <div className="text-xs font-black text-neutral-400 uppercase tracking-widest">可见性提升</div>
                <div className="mt-2 text-3xl font-black text-emerald-600">+142%</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-[3rem] bg-indigo-600 px-8 py-20 text-center sm:px-16">
            <div className="absolute inset-0 -z-10 opacity-20">
              <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            </div>
            
            <h2 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              准备好重塑你的 <br className="hidden sm:block" /> 品牌影响力了吗？
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-xl font-medium text-indigo-100">
              加入 1,000+ 领先品牌，在 AI 搜索时代抢占先机。
            </p>
            
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-16 items-center justify-center gap-2 rounded-2xl bg-white px-12 text-xl font-black text-indigo-600 shadow-2xl transition hover:bg-indigo-50 hover:-translate-y-1 active:translate-y-0"
              >
                立即免费注册
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-white/30 px-12 text-xl font-bold text-white transition hover:bg-white/10"
              >
                查看定价
              </Link>
            </div>
            
            <div className="mt-12 flex items-center justify-center gap-8 text-indigo-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-bold">数据安全保障</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                <span className="text-sm font-bold">多引擎驱动</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo size="lg" />
              <p className="mt-6 max-w-sm text-lg font-medium text-neutral-500 leading-relaxed">
                AI 时代的品牌可观测性与增长平台。我们致力于帮助每一个优秀的产品在 AI 的回答中被看见。
              </p>
              <div className="mt-8 flex gap-4">
                {/* Social links placeholders */}
                <div className="h-10 w-10 rounded-full bg-neutral-100 transition hover:bg-neutral-200" />
                <div className="h-10 w-10 rounded-full bg-neutral-100 transition hover:bg-neutral-200" />
                <div className="h-10 w-10 rounded-full bg-neutral-100 transition hover:bg-neutral-200" />
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">产品</h4>
              <ul className="mt-6 space-y-4">
                <li><a href="#features" className="font-bold text-neutral-600 transition hover:text-indigo-600">核心功能</a></li>
                <li><Link href="/pricing" className="font-bold text-neutral-600 transition hover:text-indigo-600">定价方案</Link></li>
                <li><a href="#audit-tool" className="font-bold text-neutral-600 transition hover:text-indigo-600">审计工具</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-neutral-400">公司</h4>
              <ul className="mt-6 space-y-4">
                <li><Link href="/login" className="font-bold text-neutral-600 transition hover:text-indigo-600">关于我们</Link></li>
                <li><a href="mailto:hello@geoscore.ai" className="font-bold text-neutral-600 transition hover:text-indigo-600">联系我们</a></li>
                <li><Link href="/register" className="font-bold text-neutral-600 transition hover:text-indigo-600">加入我们</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-20 flex flex-col items-center justify-between gap-6 border-t border-neutral-100 pt-8 sm:flex-row">
            <p className="text-sm font-bold text-neutral-400">
              © {new Date().getFullYear()} 极排. All rights reserved.
            </p>
            <div className="flex gap-8 text-sm font-bold text-neutral-400">
              <a href="#" className="hover:text-neutral-900 transition">隐私政策</a>
              <a href="#" className="hover:text-neutral-900 transition">服务条款</a>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
