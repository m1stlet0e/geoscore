import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  Compass,
  Eye,
  Globe2,
  Map as MapIcon,
  PlayCircle,
  Quote,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PricingTable } from '@/components/PricingTable';
import { AI_PLATFORMS, PLAN_LIMITS } from '@/lib/constants';

export const dynamic = 'force-static';

/* ─── Data ─── */

const MODULES: Array<{
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { id: 'monitor', title: 'AI 监控中心', desc: '7 个 AI 引擎统一扫描，逐日追踪品牌可见性、排名、情感倾向。', icon: Radar, color: '#6366f1' },
  { id: 'citations', title: '引用分析', desc: '逐条 AI 答案溯源，定位你的品牌被引用 / 缺席的具体上下文。', icon: Quote, color: '#06b6d4' },
  { id: 'sources', title: '来源追踪', desc: 'AI 答案背后的域名、媒体、社区归因，识别高权重源与待补缺口。', icon: Globe2, color: '#10b981' },
  { id: 'influence', title: '影响力地图', desc: '品牌 × 竞品 × 品类的知识图谱，一眼看清心智位置。', icon: MapIcon, color: '#8b5cf6' },
  { id: 'gaps', title: '缺口分析', desc: '竞品被引用、你没有 → 自动给出"应该发什么内容"清单。', icon: Target, color: '#f59e0b' },
  { id: 'growth', title: 'Growth Agent', desc: '基于缺口自动生成博客 / FAQ / Schema，一键发布到 8 个渠道。', icon: Sparkles, color: '#ec4899' },
  { id: 'radar', title: 'Prompt Radar', desc: '实时发现新出现的问题、话题，识别下一波该抢占的 query。', icon: TrendingUp, color: '#3b82f6' },
  { id: 'forecast', title: '推荐预测', desc: '基于历史 + 趋势信号，预测 30 / 90 天后的品牌推荐位。', icon: Compass, color: '#ef4444' },
];

const STEPS = [
  { n: '01', title: '添加品牌与关键词', desc: '输入品牌名、域名和 5–500 个你想监控的 prompt 关键词，30 秒接入。', icon: Rocket },
  { n: '02', title: '跨 7 个 AI 引擎扫描', desc: 'GeoScore 自动向 ChatGPT、Perplexity、Gemini、Claude 等发起真实查询。', icon: Eye },
  { n: '03', title: '看到缺口，自动补救', desc: 'AI 告诉你"在哪里、为什么、被谁挤掉"，并直接生成可发布的内容。', icon: Bot },
];

const FAQ_ITEMS = [
  { q: 'GeoScore 和传统 SEO 工具（如 Ahrefs）有什么区别？', a: '传统工具衡量"用户在 Google 上能不能找到你"，GeoScore 衡量"AI 在回答用户时会不会提到你"。GEO 时代的流量入口已经从搜索结果页转向 AI 答案。' },
  { q: '你们怎么调用 ChatGPT / Perplexity 这些模型？', a: '使用各家官方 API，在受控 prompt 模板下发出与真实用户最接近的查询，记录完整 response、citation、latency 与情感倾向。' },
  { q: '品牌还没在 AI 里被引用，接入有意义吗？', a: '更有意义。你能在被竞品"先占位"之前看清空白点，GeoScore 会告诉你"应该发什么"。' },
  { q: '数据安全 / 隐私？', a: 'GROWTH 及以上套餐支持 SSO/SAML、审计日志。账号密码 bcrypt 加盐存储，会话采用 NextAuth JWT。' },
  { q: '能试用吗？', a: '免费版支持监控 1 个品牌、5 个关键词，无需信用卡，直接注册即用。' },
];

const STATS = [
  { value: '1,200+', label: '品牌正在使用' },
  { value: '7', label: 'AI 引擎覆盖' },
  { value: '50M+', label: '月查询量' },
  { value: '99.9%', label: '可用性 SLA' },
];

/* ─── Page ─── */

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ===================== Nav ===================== */}
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="md" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-600 md:flex">
            <a href="#features" className="transition hover:text-neutral-900">功能</a>
            <a href="#how" className="transition hover:text-neutral-900">原理</a>
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

      {/* ===================== Hero ===================== */}
      <section className="relative pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4">
          <div className="absolute inset-0 rounded-full bg-indigo-500/[0.07] blur-[100px]" />
          <div className="absolute left-1/4 top-1/3 h-64 w-64 rounded-full bg-violet-500/[0.05] blur-[80px]" />
          <div className="absolute right-1/4 top-1/2 h-48 w-48 rounded-full bg-cyan-500/[0.04] blur-[60px]" />
        </div>

        <div className="mx-auto max-w-4xl px-5 text-center sm:px-6">
          {/* Eyebrow */}
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
            </span>
            实时监控 7 大 AI 引擎
          </div>

          {/* Headline — Stripe-style light weight */}
          <h1 className="mt-8 text-5xl font-bold leading-[1.05] tracking-tight text-neutral-900 sm:text-6xl lg:text-[5.5rem]" style={{ letterSpacing: '-0.02em' }}>
            Rank In AI,
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-500 bg-clip-text font-bold text-transparent">
              Not Just Google.
            </span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-xl leading-relaxed text-neutral-500">
            GeoScore 是面向 AI 时代的<strong className="font-medium text-neutral-700">生成式引擎优化 (GEO)</strong> 操作系统。监控你的品牌在 ChatGPT、Perplexity、Gemini 等 7 大 AI 引擎中的可见性、引用与排名，并自动生产可发布的内容。
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 hover:shadow-indigo-500/30"
            >
              Start Free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-8 py-4 text-base font-medium text-neutral-700 shadow-sm transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              <PlayCircle className="h-4 w-4 text-indigo-500" />
              Watch Demo
            </a>
          </div>

          <p className="mt-5 text-xs text-neutral-400">
            免信用卡 · 1 分钟接入 · 永久免费版可用
          </p>
        </div>

        {/* Stats strip */}
        <div className="mx-auto mt-16 max-w-4xl px-5 sm:px-6">
          <div className="grid grid-cols-2 gap-px rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1 bg-white px-6 py-5">
                <div className="text-3xl font-bold tracking-tight text-neutral-900">{s.value}</div>
                <div className="text-sm text-neutral-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== Features ===================== */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <SectionHeader
            eyebrow="8 大模块 · 一站完成"
            title="一个工作台，覆盖 GEO 全链路"
            subtitle="从可观测性 → 归因 → 影响力建模 → 缺口补救 → 内容生产 → 多渠道发布，8 个模块无缝串联。"
          />

          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
                >
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: `${m.color}12`, color: m.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">{m.desc}</p>
                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                    了解更多 <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== AI Platforms ===================== */}
      <section id="platforms" className="relative py-24 sm:py-32 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <SectionHeader
            eyebrow="7 个 AI 引擎 · 一个看板"
            title="每一个 AI 答案都被审计"
            subtitle="GeoScore 通过各家官方 API，在受控模板下向真实用户最可能问的问题发起查询，记录完整 response、citation、latency 与情感。"
          />

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {AI_PLATFORMS.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3 py-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                  style={{ background: `${p.color}14`, color: p.color }}
                >
                  {p.icon}
                </div>
                <div className="text-sm font-medium text-neutral-800">{p.name}</div>
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" />
                  verified
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== How it works ===================== */}
      <section id="how" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <SectionHeader
            eyebrow="3 步闭环"
            title="从看不见到被推荐"
            subtitle="不需要 SEO 团队，不需要 RD，30 秒接入，3 步闭环。"
          />

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="relative">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-5xl font-bold tracking-tight text-neutral-200">{s.n}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-neutral-900">{s.title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-neutral-500">{s.desc}</p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-neutral-300 md:block">
                      <ChevronRight className="h-6 w-6" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== Pricing ===================== */}
      <section id="pricing" className="relative py-24 sm:py-32 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <SectionHeader
            eyebrow="定价"
            title="按规模付费，永久免费版也能用"
            subtitle="从个人到企业，4 档清晰，所有方案都包含 7 引擎监控。"
          />

          <div className="mt-16">
            <PricingTable />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-base text-neutral-500">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> 30 天无理由退款
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 随时升级 / 降级 / 取消
            </span>
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-500" /> 7×24 监控 + 告警
            </span>
          </div>

          <div className="mt-6 text-center text-sm text-neutral-500">
            想看完整对比？查看{' '}
            <Link href="/pricing" className="font-medium text-indigo-600 hover:text-indigo-700">
              价格详情 →
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== FAQ ===================== */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-6">
          <SectionHeader eyebrow="常见问题" title="FAQ" subtitle="" />

          <div className="mt-12 space-y-0 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
            {FAQ_ITEMS.map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-base font-semibold text-neutral-800 marker:hidden [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 transition group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-5 text-base leading-relaxed text-neutral-500">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== Final CTA ===================== */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-5 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-16 text-center shadow-xl shadow-indigo-500/20 sm:px-16">
            {/* Decorative circles */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-white/[0.08] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-white/[0.06] blur-2xl" />

            <div className="relative">
              <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl" style={{ letterSpacing: '-0.015em' }}>
                让 AI 主动提起你
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
                注册 30 秒拿到你品牌的 AI 可见性快照。免费版永久可用，不需要信用卡。
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                >
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-8 py-4 text-base font-medium text-white transition hover:bg-white/10"
                >
                  查看价格
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== Footer ===================== */}
      <footer className="border-t border-neutral-200 bg-neutral-50 py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo size="md" />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-neutral-500">
                AI 时代的品牌可观测性 · 监控、归因、补位、增长，一套操作系统。
              </p>
              <div className="mt-6 text-xs text-neutral-400">
                © {new Date().getFullYear()} GeoScore. All rights reserved.
              </div>
            </div>
            <FooterCol
              title="产品"
              links={[
                { label: '功能', href: '#features' },
                { label: '价格', href: '/pricing' },
                { label: 'AI 引擎', href: '#platforms' },
                { label: 'Changelog', href: '/changelog' },
              ]}
            />
            <FooterCol
              title="资源"
              links={[
                { label: '文档', href: '/docs' },
                { label: '博客', href: '/blog' },
                { label: '客户案例', href: '/cases' },
                { label: '联系销售', href: 'mailto:hello@geoscore.ai' },
              ]}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Helpers ─── */

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-sm font-semibold uppercase tracking-[0.12em] text-indigo-600">{eyebrow}</div>
      <h2
        className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-[2.75rem]"
        style={{ letterSpacing: '-0.02em' }}
      >
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-neutral-500">{subtitle}</p>}
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{title}</div>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-sm text-neutral-500 transition hover:text-neutral-900">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
