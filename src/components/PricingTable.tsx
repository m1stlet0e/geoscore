import Link from 'next/link';
import { Check, Sparkles, X } from 'lucide-react';
import { PLAN_LIMITS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type Tier = keyof typeof PLAN_LIMITS;

const TIER_ORDER: Tier[] = ['FREE', 'PRO', 'GROWTH', 'ENTERPRISE'];

const TIER_META: Record<Tier, { tagline: string; highlight: boolean; cta: string }> = {
  FREE:       { tagline: '个人尝鲜 / 试用',           highlight: false, cta: '免费开始' },
  PRO:        { tagline: '小型团队 / 增长负责人',     highlight: true,  cta: '升级 PRO' },
  GROWTH:     { tagline: '增长团队 / 代理机构',       highlight: false, cta: '升级 GROWTH' },
  ENTERPRISE: { tagline: '大企业 / 定制',             highlight: false, cta: '联系销售' },
};

const TIER_FEATURES: Record<Tier, string[]> = {
  FREE: [
    '监控 1 个品牌',
    '5 个关键词',
    '50 个 prompt / 月',
    '每日 1 次扫描',
    '可见性评分',
  ],
  PRO: [
    '监控 5 个品牌',
    '100 个关键词',
    '5,000 个 prompt / 月',
    '每日 10 次扫描',
    '20 篇 AI 生成内容',
    '引用分析 + 来源追踪',
  ],
  GROWTH: [
    '监控 25 个品牌',
    '500 个关键词',
    '50,000 个 prompt / 月',
    '每日 50 次扫描',
    '200 篇 AI 内容 + 自动发布',
    '3 个团队席位',
    '影响力地图 + 预测',
  ],
  ENTERPRISE: [
    '无限品牌 / 关键词 / prompts',
    '无限次扫描',
    '无限内容 + 多渠道发布',
    'SSO / SAML',
    '专属客户成功 + SLA',
    '私有部署 / API 接入',
    '审计日志 + 合规',
  ],
};

function formatLimit(v: number, suffix = '') {
  if (v === -1) return '∞' + suffix;
  return v.toLocaleString('en-US') + suffix;
}

export function PricingTable() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TIER_ORDER.map((tier) => {
        const limits = PLAN_LIMITS[tier];
        const meta = TIER_META[tier];
        const features = TIER_FEATURES[tier];

        return (
          <div
            key={tier}
            className={cn(
              'relative flex flex-col rounded-2xl border bg-slate-900/50 p-6 backdrop-blur transition',
              meta.highlight
                ? 'border-indigo-500/50 shadow-[0_0_0_1px_rgba(99,102,241,0.25),0_20px_60px_-20px_rgba(99,102,241,0.5)]'
                : 'border-slate-800 hover:border-slate-700'
            )}
          >
            {meta.highlight ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/40 bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-indigo-500/30">
                  <Sparkles className="h-3 w-3" /> 最受欢迎
                </span>
              </div>
            ) : null}

            <div className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-300">
              {tier}
            </div>
            <div className="mb-4 text-xs text-slate-500">{meta.tagline}</div>

            <div className="mb-5 flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-slate-50">
                {limits.price === 0 ? '¥0' : `¥${limits.price}`}
              </span>
              <span className="text-sm text-slate-500">
                {limits.price === 0 ? '永久免费' : '/ 月'}
              </span>
            </div>

            <ul className="mb-6 space-y-2.5 text-sm">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-[11px]">
              <Stat label="关键词" value={formatLimit(limits.keywords)} />
              <Stat label="Prompts/月" value={formatLimit(limits.prompts)} />
              <Stat label="每日扫描" value={formatLimit(limits.scansPerDay)} />
              <Stat label="内容 / 月" value={formatLimit(limits.contentPieces)} />
            </div>

            <Link
              href={tier === 'ENTERPRISE' ? '/register?plan=enterprise' : '/register?plan=' + tier.toLowerCase()}
              className={cn(
                'mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition',
                meta.highlight
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-violet-400'
                  : tier === 'FREE'
                    ? 'border border-slate-700 bg-slate-800/60 text-slate-100 hover:bg-slate-800'
                    : 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20'
              )}
            >
              {meta.cta}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-100">{value}</div>
    </div>
  );
}

export function PricingTableCompact() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-4 py-3">能力</th>
            {TIER_ORDER.map((t) => (
              <th key={t} className="px-4 py-3 text-center">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70 text-slate-300">
          <Row label="品牌数" get={(t) => t === 'ENTERPRISE' ? '∞' : (t === 'FREE' ? '1' : t === 'PRO' ? '5' : '25')} />
          <Row label="关键词" get={(t) => formatLimit(PLAN_LIMITS[t].keywords)} />
          <Row label="Prompts / 月" get={(t) => formatLimit(PLAN_LIMITS[t].prompts)} />
          <Row label="每日扫描" get={(t) => formatLimit(PLAN_LIMITS[t].scansPerDay)} />
          <Row label="AI 内容 / 月" get={(t) => formatLimit(PLAN_LIMITS[t].contentPieces)} />
          <Row label="团队席位" get={(t) => formatLimit(PLAN_LIMITS[t].seats)} />
          <Row label="引用分析" get={(t) => (t === 'FREE' ? <Cross /> : <CheckIcon />)} />
          <Row label="来源追踪" get={(t) => (t === 'FREE' ? <Cross /> : <CheckIcon />)} />
          <Row label="影响力地图" get={(t) => (t === 'PRO' ? <Cross /> : <CheckIcon />)} />
          <Row label="AI 内容 + 发布" get={(t) => (t === 'PRO' || t === 'GROWTH' || t === 'ENTERPRISE' ? <CheckIcon /> : <Cross />)} />
          <Row label="预测 / Forecast" get={(t) => (t === 'GROWTH' || t === 'ENTERPRISE' ? <CheckIcon /> : <Cross />)} />
          <Row label="SSO / SAML" get={(t) => (t === 'ENTERPRISE' ? <CheckIcon /> : <Cross />)} />
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, get }: { label: string; get: (t: Tier) => React.ReactNode }) {
  return (
    <tr className="hover:bg-slate-900/40">
      <td className="px-4 py-2.5 text-slate-300">{label}</td>
      {TIER_ORDER.map((t) => (
        <td key={t} className="px-4 py-2.5 text-center text-slate-200">{get(t)}</td>
      ))}
    </tr>
  );
}

function CheckIcon() {
  return <Check className="mx-auto h-4 w-4 text-emerald-400" />;
}
function Cross() {
  return <X className="mx-auto h-4 w-4 text-slate-600" />;
}
