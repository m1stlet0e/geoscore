import Link from "next/link";
import { headers } from "next/headers";
import { ArrowUpRight, HeartPulse, ShieldAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadReputationForUser } from "@/server/intelligence/loader";
import { formatAiProviderLabel } from "@/lib/growth-data";

const labels = { positive: "正面", neutral: "中性", mixed: "复杂", negative: "负面" } as const;

export default async function ReputationPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const data = await loadReputationForUser(session.user.id);
  const total = Math.max(1, Object.values(data.distribution).reduce((sum, value) => sum + value, 0));
  return <main className="dashboard-page intelligence-page reputation-page">
    <header className="intelligence-page-header"><div><p className="eyebrow"><HeartPulse size={15} /> REPUTATION WATCH</p><h1>AI 是怎样向客户<br />描述你的品牌？</h1><p>不只统计好坏，还保留每条负面评价来自哪个问题、哪个 AI 数据源的证据。</p></div><div className="reputation-total"><span>已分析目标提及</span><strong>{data.totalMentions}</strong><small>来自已完成扫描</small></div></header>
    <section className="sentiment-overview"><div className="sentiment-ring"><strong>{Math.round((data.distribution.positive / total) * 100)}%</strong><span>正面倾向</span></div><div className="sentiment-bars">{Object.entries(data.distribution).map(([key, value]) => <div key={key}><span>{labels[key as keyof typeof labels]}</span><i><b style={{ width: `${(value / total) * 100}%` }} /></i><strong>{value}</strong></div>)}</div></section>
    <section className="reputation-grid"><div className="negative-evidence-panel"><div className="intelligence-section-heading"><div><span>NEGATIVE EVIDENCE</span><h2>负面评价溯源</h2></div><p>只展示真实保存的目标品牌负面提及。</p></div>{data.negativeEvidence.length ? <div className="negative-evidence-list">{data.negativeEvidence.slice(0, 20).map((item, index) => <article key={`${item.platformId}-${item.prompt}-${index}`}><div><b>{formatAiProviderLabel(item.platformId)}</b><span>{item.prompt}</span></div><p>{item.evidence}</p></article>)}</div> : <div className="compact-empty"><strong>尚未发现负面提及</strong><p>当 AI 回答出现负面情感时，会在这里按原始证据呈现。</p></div>}</div>
      <aside className="risk-radar"><div><ShieldAlert size={20} /><span>OPEN RISKS</span></div><h2>风险雷达</h2>{data.risks.length ? data.risks.slice(0, 12).map((risk) => <Link key={risk.id} href={risk.scanId ? `/dashboard/scans/${risk.scanId}` : "/dashboard"} className={`risk-radar-item risk-${risk.level.toLowerCase()}`}><span>{risk.level}</span><strong>{risk.title}</strong><p>{risk.description}</p><ArrowUpRight size={15} /></Link>) : <p>当前没有未处理风险。</p>}</aside>
    </section>
  </main>;
}
