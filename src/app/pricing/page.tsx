import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PricingTable, PricingTableCompact } from '@/components/PricingTable';

export const metadata = {
  title: '价格 · GeoScore',
  description: 'GeoScore 4 档清晰定价,从个人免费到企业定制,所有方案都包含 7 大 AI 引擎监控。',
};

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'GeoScore 跟 Ahrefs / Semrush 有什么本质不同?',
    a: '传统 SEO 工具衡量"用户在 Google 搜索结果中能不能找到你",GeoScore 衡量"AI 在回答用户时会不会提到你、引用你、把谁排在前面"。我们面向的是 AI 答案本身,而不是搜索结果页。',
  },
  {
    q: '免费版真的可以永久用吗?',
    a: '可以。免费版支持监控 1 个品牌、5 个关键词、每日 1 次扫描,无时间限制、无需绑定信用卡。如果你之后想升级,数据会无缝迁移。',
  },
  {
    q: '你们怎么调用 ChatGPT / Perplexity / Gemini / Claude 这些模型?',
    a: '全部使用各家官方 API。我们维护了一份受控 prompt 模板库,在与真实用户最接近的场景下发起查询,并完整记录 response、citation、latency、情感倾向与品牌上下文。所有调用均符合对应平台的使用条款与速率限制。',
  },
  {
    q: 'AI 答案里完全没出现我的品牌,接入还有意义吗?',
    a: '更有意义。GeoScore 的"缺口分析"模块会告诉你"AI 在哪些问题里提到了竞品但没提你",并由 Growth Agent 直接生成可发布的内容去补位。这正是 GEO 时代最重要的红利期。',
  },
  {
    q: '可以多人协作吗?',
    a: 'GROWTH 及以上套餐包含 3 个团队席位,ENTERPRISE 不限席位。团队成员共享品牌、监控、内容、警报,支持基于角色的访问控制。',
  },
  {
    q: '数据安全 / 隐私?',
    a: '账号密码使用 bcrypt 加盐存储,会话使用 NextAuth JWT。可选的 SSO/SAML、私有部署、审计日志由 ENTERPRISE 套餐提供。我们默认不与任何第三方共享您的数据。',
  },
  {
    q: '能取消订阅吗?',
    a: '可以,随时在设置页面一键取消,本计费周期内仍可使用,数据保留 90 天。',
  },
];

export default function PricingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-radial-glow" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30" aria-hidden="true" />

      {/* Nav (lightweight, public) */}
      <header className="sticky top-0 z-30 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="md" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <Link href="/#modules" className="transition hover:text-slate-50">功能</Link>
            <Link href="/#how" className="transition hover:text-slate-50">原理</Link>
            <Link href="/#platforms" className="transition hover:text-slate-50">AI 引擎</Link>
            <Link href="/pricing" className="text-slate-50">价格</Link>
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

      {/* Hero */}
      <section className="pt-16 pb-10 sm:pt-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            定价 · 4 档清晰 · 永久免费版
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent">
              按规模付费,
            </span>
            <br />
            <span className="bg-gradient-to-br from-indigo-300 to-violet-300 bg-clip-text text-transparent">
              按价值交付。
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-400">
            所有方案均包含 7 大 AI 引擎监控、可见性评分、引用分析、来源追踪。升级后解锁自动内容生成、影响力地图、推荐预测。
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PricingTable />
        </div>
      </section>

      {/* Detailed comparison table */}
      <section className="border-t border-slate-800/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              完整功能对比
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              每一档都看得清清楚楚。
            </p>
          </div>
          <PricingTableCompact />
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-800/60 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
              FAQ · 常见问题
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-50">
              你可能想问的
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur transition open:border-indigo-500/40 open:bg-slate-900/70"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-slate-100 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180 group-open:text-indigo-300" />
                </summary>
                <div className="border-t border-slate-800/70 px-5 py-4 text-sm leading-relaxed text-slate-400">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <Logo size="sm" />
          <div>© {new Date().getFullYear()} GeoScore. All rights reserved.</div>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-slate-300">登录</Link>
            <Link href="/register" className="hover:text-slate-300">注册</Link>
            <a href="mailto:hello@geoscore.ai" className="hover:text-slate-300">联系</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
