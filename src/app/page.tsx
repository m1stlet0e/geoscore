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
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PricingTable } from '@/components/PricingTable';
import { AI_PLATFORMS, PLAN_LIMITS } from '@/lib/constants';

export const dynamic = 'force-static';

const MODULES: Array<{
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}> = [
  {
    id: 'monitor',
    title: 'AI 监控中心',
    desc: '7 个 AI 引擎统一扫描,逐日追踪品牌可见性、排名、情感倾向。',
    icon: Radar,
    accent: 'from-indigo-500/20 to-violet-500/10 text-indigo-300',
  },
  {
    id: 'citations',
    title: '引用分析',
    desc: '逐条 AI 答案溯源,定位你的品牌被引用 / 缺席的具体上下文。',
    icon: Quote,
    accent: 'from-cyan-500/20 to-sky-500/10 text-cyan-300',
  },
  {
    id: 'sources',
    title: '来源追踪',
    desc: '把 AI 答案背后的域名、媒体、社区归因,识别高权重源与待补缺口。',
    icon: Globe2,
    accent: 'from-emerald-500/20 to-teal-500/10 text-emerald-300',
  },
  {
    id: 'influence',
    title: '影响力地图',
    desc: '品牌 × 竞品 × 品类 × 子赛道 的知识图谱,一眼看清心智位置。',
    icon: MapIcon,
    accent: 'from-violet-500/20 to-fuchsia-500/10 text-violet-300',
  },
  {
    id: 'gaps',
    title: '缺口分析',
    desc: '竞品被引用、你没有 → 自动给出"应该发什么内容"清单。',
    icon: Target,
    accent: 'from-amber-500/20 to-orange-500/10 text-amber-300',
  },
  {
    id: 'growth',
    title: 'Growth Agent',
    desc: '基于缺口自动生成博客 / FAQ / Schema / Reddit 帖子,一键发布到 WordPress、Notion、Reddit 等 8 个渠道。',
    icon: Sparkles,
    accent: 'from-fuchsia-500/20 to-pink-500/10 text-fuchsia-300',
  },
  {
    id: 'radar',
    title: 'Prompt Radar',
    desc: '实时发现新出现的问题、关键词、话题,识别下一波该抢占的 query。',
    icon: TrendingUp,
    accent: 'from-sky-500/20 to-cyan-500/10 text-sky-300',
  },
  {
    id: 'forecast',
    title: '推荐预测',
    desc: '基于历史 + 趋势信号,预测 30 / 90 天后的品牌推荐位与置信度。',
    icon: Compass,
    accent: 'from-rose-500/20 to-red-500/10 text-rose-300',
  },
];

const STEPS: Array<{ n: string; title: string; desc: string; icon: React.ComponentType<{ className?: string }> }> = [
  {
    n: '01',
    title: '添加品牌与关键词',
    desc: '输入品牌名、域名和 5–500 个你想监控的 prompt 关键词,30 秒接入。',
    icon: Rocket,
  },
  {
    n: '02',
    title: '跨 7 个 AI 引擎扫描',
    desc: 'GeoScore 自动向 ChatGPT、Perplexity、Gemini、Claude 等发起真实查询,记录原文与引用源。',
    icon: Eye,
  },
  {
    n: '03',
    title: '看到缺口,自动补救',
    desc: 'AI 告诉你"在哪里、为什么、被谁挤掉",并直接生成可发布的内容。',
    icon: Bot,
  },
];

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'GeoScore 和传统的 SEO 工具(比如 Ahrefs)有什么区别?',
    a: '传统工具衡量"用户在 Google 上能不能找到你",GeoScore 衡量"AI 在回答用户时会不会提到你"。GEO 时代的流量入口已经从搜索结果页转向 AI 答案,这是新一类的可观测性。',
  },
  {
    q: '你们怎么调用 ChatGPT / Perplexity 这些模型?',
    a: '我们使用各家官方 API,在受控 prompt 模板下发出与真实用户最接近的查询,并记录完整的 response、citation、latency 与情感倾向。所有调用均符合对应平台的使用条款。',
  },
  {
    q: '品牌还没在 AI 里被引用,接入有意义吗?',
    a: '更有意义。你能在被竞品"先占位"之前看清空白点,GeoScore 会告诉你"应该发什么"——这正是 Growth Agent 的工作。',
  },
  {
    q: '数据安全 / 隐私?',
    a: 'GROWTH 及以上套餐支持 SSO/SAML、审计日志、私有部署。账号、密码使用 bcrypt 加盐存储,会话采用 NextAuth JWT。',
  },
  {
    q: '能试用吗?',
    a: '可以。免费版支持监控 1 个品牌、5 个关键词,无需信用卡,直接注册即用。',
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-radial-glow" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-40" aria-hidden="true" />
      <div className="pointer-events-none fixed -top-40 left-1/2 -z-10 h-[500px] w-[1100px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl" aria-hidden="true" />

      {/* ===================== Nav ===================== */}
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="md" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#modules" className="transition hover:text-slate-50">功能</a>
            <a href="#how" className="transition hover:text-slate-50">原理</a>
            <a href="#platforms" className="transition hover:text-slate-50">AI 引擎</a>
            <Link href="/pricing" className="transition hover:text-slate-50">价格</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:text-slate-50 sm:inline-flex"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
            >
              免费开始 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ===================== Hero ===================== */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200 animate-fade-up">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
            </span>
            <span>🤖 Now monitoring 7 AI engines · 实时监控 7 大 AI 引擎</span>
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl animate-fade-up">
            <span className="bg-gradient-to-br from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
              Rank In AI,
            </span>
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-br from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Not Just Google.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg animate-fade-up">
            GeoScore 是面向 AI 时代的{' '}
            <span className="font-semibold text-slate-200">生成式引擎优化 (GEO)</span>{' '}
            操作系统。监控你的品牌在 ChatGPT、Perplexity、Gemini、Claude 等
            7 大 AI 引擎中的可见性、引用与排名,并自动生产可发布的内容。
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-400/40 hover:from-indigo-400 hover:to-violet-400"
            >
              Start Free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
            >
              <PlayCircle className="h-4 w-4 text-indigo-300" />
              Watch Demo
            </a>
          </div>

          <p className="mt-6 text-xs text-slate-500 animate-fade-up">
            免信用卡 · 1 分钟接入 · 永久免费版可用
          </p>
        </div>

        {/* Social proof */}
        <div className="mx-auto mt-14 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-6 py-5 text-center backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Social Proof
            </div>
            <div className="mt-2 text-base text-slate-200 sm:text-lg">
              <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-xl font-semibold text-transparent sm:text-2xl">
                1,200+
              </span>{' '}
              品牌正在使用 GeoScore 追踪 AI 可见性 · 覆盖 SaaS / DTC / 金融科技 / B2B 服务
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-slate-500">
              <span>Notion-style workflow</span>
              <span className="text-slate-700">·</span>
              <span>SOC2-ready</span>
              <span className="text-slate-700">·</span>
              <span>中文 / English</span>
              <span className="text-slate-700">·</span>
              <span>GDPR / 数据本地化</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== Modules ===================== */}
      <section id="modules" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="8 大模块 · 一站完成"
            title={<>一个工作台,覆盖 <Gradient>GEO 全部</Gradient> 链路</>}
            subtitle="从可观测性 → 归因 → 影响力建模 → 缺口补救 → 内容生产 → 多渠道发布,8 个模块无缝串联。"
          />

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-[0_20px_60px_-30px_rgba(99,102,241,0.6)]"
                >
                  <div
                    className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${m.accent} opacity-40 blur-2xl transition group-hover:opacity-70`}
                    aria-hidden="true"
                  />
                  <div className="relative">
                    <div
                      className={`mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700/80 bg-gradient-to-br ${m.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-50">{m.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{m.desc}</p>
                    <div className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-indigo-300 opacity-0 transition group-hover:opacity-100">
                      了解更多 <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== AI Platforms ===================== */}
      <section id="platforms" className="relative py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="7 个 AI 引擎 · 一个看板"
            title={<>每一个 <Gradient>AI 答案</Gradient> 都被审计</>}
            subtitle="GeoScore 通过各家官方 API,在受控模板下向真实用户最可能问的问题发起查询,记录完整 response、citation、latency 与情感。"
          />

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {AI_PLATFORMS.map((p) => (
              <div
                key={p.id}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-5 text-center transition hover:border-slate-700 hover:bg-slate-900/70"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                  style={{ background: `${p.color}1f`, color: p.color }}
                >
                  {p.icon}
                </div>
                <div className="text-sm font-medium text-slate-100">{p.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">API verified</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== How it works ===================== */}
      <section id="how" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="3 步闭环"
            title={<>从 <Gradient>看不见</Gradient> 到 <Gradient>被推荐</Gradient></>}
            subtitle="不需要 SEO 团队,不需要 RD,30 秒接入,3 步闭环。"
          />

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.n}
                  className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/60 to-slate-950/40 p-7"
                >
                  <div className="absolute -right-4 -top-4 text-7xl font-bold text-slate-800/40 select-none">
                    {s.n}
                  </div>
                  <div className="relative">
                    <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-50">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
                  </div>
                  {i < STEPS.length - 1 ? (
                    <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-700 md:block">
                      <ChevronRight className="h-6 w-6" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== Pricing ===================== */}
      <section id="pricing" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow="定价"
            title={<>按规模付费,<Gradient>永久免费版</Gradient> 也能用</>}
            subtitle="从个人到企业,4 档清晰,所有方案都包含 7 引擎监控。"
          />

          <div className="mt-14">
            <PricingTable />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 text-xs text-slate-500 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> 30 天无理由退款
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 随时升级 / 降级 / 取消
            </div>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-400" /> 7×24 监控 + 告警
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-400">
            想看完整对比?查看{' '}
            <Link href="/pricing" className="text-indigo-300 hover:text-indigo-200">
              价格详情 →
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== Final CTA ===================== */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-10 text-center shadow-[0_30px_120px_-30px_rgba(99,102,241,0.45)] sm:p-16">
            <div className="pointer-events-none absolute inset-0 -z-0 bg-radial-glow opacity-80" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
                让 AI 主动提起你
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
                注册 30 秒拿到你品牌的 AI 可见性快照。免费版永久可用,不需要信用卡。
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-400 hover:to-violet-400"
                >
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-7 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
                >
                  查看价格
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== Footer ===================== */}
      <footer className="border-t border-slate-800/60 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo size="md" />
              <p className="mt-3 max-w-md text-sm text-slate-400">
                AI 时代的品牌可观测性 · 监控、归因、补位、增长,一套操作系统。
              </p>
              <div className="mt-4 text-xs text-slate-500">
                © {new Date().getFullYear()} GeoScore. All rights reserved.
              </div>
            </div>
            <FooterCol
              title="产品"
              links={[
                { label: '功能', href: '#modules' },
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

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
        {eyebrow}
      </div>
      <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base text-slate-400">{subtitle}</p>
    </div>
  );
}

function Gradient({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="text-slate-400 transition hover:text-slate-100">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}


