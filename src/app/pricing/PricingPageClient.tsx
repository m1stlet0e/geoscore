'use client';

import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';

type Plan = 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE';

interface PlanConfig {
  name: string;
  price: number;
  quotas: Record<string, number>;
  features: string[];
}

type PlanMap = Record<Plan, PlanConfig>;

const TIER_ORDER: Plan[] = ['FREE', 'PRO', 'GROWTH', 'ENTERPRISE'];

const TIER_META: Record<
  Plan,
  { tagline: string; highlight: boolean; cta: string; ctaLink: string }
> = {
  FREE: {
    tagline: '个人尝鲜 / 试用',
    highlight: false,
    cta: '开始使用',
    ctaLink: '/register?plan=free',
  },
  PRO: {
    tagline: '小型团队 / 增长负责人',
    highlight: true,
    cta: '升级 PRO',
    ctaLink: '/register?plan=pro',
  },
  GROWTH: {
    tagline: '增长团队 / 代理机构',
    highlight: false,
    cta: '升级 GROWTH',
    ctaLink: '/register?plan=growth',
  },
  ENTERPRISE: {
    tagline: '大企业 / 定制',
    highlight: false,
    cta: '联系我们',
    ctaLink: 'mailto:hello@geoscore.ai',
  },
};

const QUOTA_LABELS: Record<string, string> = {
  SCAN: '扫描次数/月',
  PROMPT: 'Prompt 数量/月',
  CITATION_ANALYSIS: '引用分析/月',
  GAP_ANALYSIS: '缺口分析/月',
  CONTENT_GENERATE: '内容生成/月',
  REPORT_GENERATE: '报告生成/月',
};

const TIER_FEATURES: Record<Plan, string[]> = {
  FREE: ['基础监控', '5 个品牌', '每周报告', '可见性评分'],
  PRO: [
    '完整监控',
    '20 个品牌',
    '每日报告',
    'Citation 分析',
    'Gap 分析',
    '内容生成',
  ],
  GROWTH: [
    '全部功能',
    '50 个品牌',
    '实时报告',
    '内容生成 + 自动发布',
    '3 个团队席位',
    '影响力地图 + 预测',
    '优先支持',
  ],
  ENTERPRISE: [
    '无限额度',
    '无限品牌',
    '专属客服',
    'API 接口',
    '定制报告',
    'SSO / SAML',
    '私有部署',
    '审计日志 + 合规',
  ],
};

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: '极排 跟 Ahrefs / Semrush 有什么本质不同?',
    a: '传统 SEO 工具衡量"用户在 Google 搜索结果中能不能找到你",极排 衡量"AI 在回答用户时会不会提到你、引用你、把谁排在前面"。我们面向的是 AI 答案本身,而不是搜索结果页。',
  },
  {
    q: '免费版真的可以永久用吗?',
    a: '可以。免费版支持监控 1 个品牌、5 个关键词、每日 1 次扫描，无时间限制、无需绑定支付方式。升级后支持微信支付/支付宝，数据无缝迁移。',
  },
  {
    q: '你们怎么调用 文心一言 / 豆包 / 通义千问 / Kimi 这些模型?',
    a: '全部使用各家官方 API。我们维护了一份受控 prompt 模板库,在与真实用户最接近的场景下发起查询,并完整记录 response、citation、latency、情感倾向与品牌上下文。所有调用均符合对应平台的使用条款与速率限制。',
  },
  {
    q: 'AI 答案里完全没出现我的品牌,接入还有意义吗?',
    a: '更有意义。极排 的"缺口分析"模块会告诉你"AI 在哪些问题里提到了竞品但没提你",并由 Growth Agent 直接生成可发布的内容去补位。这正是 GEO 时代最重要的红利期。',
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

function formatLimit(v: number) {
  if (v >= 999999) return '∞';
  return v.toLocaleString('zh-CN');
}

export function PricingPageClient({
  plans,
  userPlan,
}: {
  plans: PlanMap;
  userPlan: Plan | null;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-grid opacity-30"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="md" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-neutral-600 md:flex">
            <Link href="/#modules" className="transition hover:text-neutral-900">功能</Link>
            <Link href="/#how" className="transition hover:text-neutral-900">原理</Link>
            <Link href="/#platforms" className="transition hover:text-neutral-900">AI 引擎</Link>
            <Link href="/pricing" className="text-neutral-900">价格</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-1.5 text-sm text-neutral-600 transition hover:text-neutral-900 sm:inline-flex"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
            >
              免费开始 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-16 pb-10 sm:pt-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-3 py-1 text-xs text-indigo-600">
            定价 · 4 档清晰 · 永久免费版
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-br from-neutral-900 to-neutral-500 bg-clip-text text-transparent">
              选择适合你的套餐
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-700">
            所有方案均包含 7 大 AI 引擎监控、可见性评分、引用分析、来源追踪。升级后解锁自动内容生成、影响力地图、推荐预测。
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TIER_ORDER.map((tier) => {
              const config = plans[tier];
              if (!config) return null;
              const meta = TIER_META[tier];
              const features = TIER_FEATURES[tier];
              const isCurrentPlan = userPlan === tier;

              return (
                <div
                  key={tier}
                  className={`relative flex flex-col rounded-2xl border bg-neutral-50 p-6 backdrop-blur transition ${
                    meta.highlight
                      ? 'border-indigo-500/50 shadow-[0_0_0_1px_rgba(99,102,241,0.25),0_20px_60px_-20px_rgba(99,102,241,0.5)]'
                      : 'border-neutral-300 hover:border-neutral-300'
                  }`}
                >
                  {meta.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/40 bg-indigo-500 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-indigo-500/30">
                        <Sparkles className="h-3 w-3" /> 最受欢迎
                      </span>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                        当前套餐
                      </span>
                    </div>
                  )}

                  <div className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-600">
                    {config.name}
                  </div>
                  <div className="mb-4 text-xs text-neutral-700">{meta.tagline}</div>

                  <div className="mb-5 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-neutral-900">
                      {config.price === 0 ? '¥0' : `¥${config.price}`}
                    </span>
                    <span className="text-sm text-neutral-700">
                      {config.price === 0 ? '永久免费' : '/ 月'}
                    </span>
                  </div>

                  <ul className="mb-5 space-y-2.5 text-sm">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-neutral-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mb-5 rounded-lg border border-neutral-300 bg-white/50 p-3">
                    <div className="mb-2 text-xs uppercase tracking-wider text-neutral-700">
                      额度限制
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(config.quotas).map(([key, value]) => (
                        <div key={key}>
                          <div className="truncate text-neutral-700">
                            {QUOTA_LABELS[key] ?? key}
                          </div>
                          <div className="font-semibold tabular-nums text-neutral-800">
                            {formatLimit(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    href={isCurrentPlan ? '/settings/billing' : meta.ctaLink}
                    className={`mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      meta.highlight
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600'
                        : tier === 'FREE'
                          ? 'border border-neutral-300 bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                          : 'border border-indigo-500/30 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                  >
                    {isCurrentPlan ? '管理订阅' : meta.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-50 px-3 py-1 text-xs text-indigo-600">
              FAQ · 常见问题
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
              你可能想问的
            </h2>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.q}
                className="group overflow-hidden rounded-xl border border-neutral-300 bg-neutral-100 backdrop-blur transition open:border-indigo-500/40 open:bg-neutral-50/70"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-neutral-800 marker:hidden [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-neutral-700 transition group-open:rotate-180 group-open:text-indigo-500" />
                </summary>
                <div className="border-t border-neutral-200 px-5 py-4 text-sm leading-relaxed text-neutral-700">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-neutral-700 sm:flex-row sm:px-6 lg:px-8">
          <Logo size="sm" />
          <div>© {new Date().getFullYear()} 极排. All rights reserved.</div>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-neutral-600">登录</Link>
            <Link href="/register" className="hover:text-neutral-600">注册</Link>
            <a href="mailto:hello@geoscore.ai" className="hover:text-neutral-600">联系</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
