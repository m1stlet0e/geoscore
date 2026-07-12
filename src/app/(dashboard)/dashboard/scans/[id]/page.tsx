import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScoreCard } from "@/components/score/score-card";
import { EvidenceList } from "@/components/score/evidence-list";

export default async function ScanReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id } = await params;
  const scan = await db.scan.findFirst({
    where: { id, brand: { ownerId: session.user.id } },
    include: {
      brand: { include: { recommendations: { orderBy: { createdAt: "desc" }, take: 3 }, riskFindings: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 3 } } }, scoreSnapshot: true,
      observations: { orderBy: { createdAt: "asc" }, include: { promptVersion: true, mentions: true, citations: true } },
    },
  });
  if (!scan || !scan.scoreSnapshot) notFound();
  const score = scan.scoreSnapshot;
  const metrics = [["品牌提及度", score.mentionScore], ["品牌推荐度", score.recommendationScore], ["竞品声量", score.shareOfVoiceScore], ["内容引用度", score.citationScore], ["品牌情感度", score.sentimentScore]] as const;
  return <main className="dashboard-page report-page">
    <Link href={`/dashboard/brands/${scan.brandId}`} className="back-link">← 返回 {scan.brand.name}</Link>
    <header><div><p className="eyebrow">AI 可见度报告</p><h1>{scan.brand.name}</h1><p>扫描 {scan.observations.length} 条真实保存的 AI 回答 · {scan.completedAt?.toLocaleString("zh-CN")}</p></div></header>
    <ScoreCard score={score.score} confidence={score.confidenceScore} provisional={score.isProvisional} riskLevel={score.riskLevel} />
    <section className="report-metrics">{metrics.map(([name, value]) => <article key={name}><span>{name}</span><strong>{value.toFixed(0)}</strong><i><b style={{ width: `${Math.max(2, value)}%` }} /></i></article>)}</section>
    {scan.brand.riskFindings.length > 0 && <section className="report-section"><div><p className="eyebrow">风险发现</p><h2>需要优先核查的信息</h2></div><div className="insight-grid risk-grid">{scan.brand.riskFindings.map((risk) => <article key={risk.id}><span>{risk.level}</span><h3>{risk.title}</h3><p>{risk.description}</p><small>{risk.evidence}</small></article>)}</div></section>}
    <section className="report-section"><div><p className="eyebrow">优化建议</p><h2>下一步先做什么</h2></div><div className="insight-grid">{scan.brand.recommendations.map((item) => <article key={item.id}><span>影响 {item.impact} · 置信 {item.confidence} · 成本 {item.effort}</span><h3>{item.title}</h3><p>{item.finding}</p><strong>{item.action}</strong><small>{item.evidence}</small></article>)}</div></section>
    <section className="report-section"><div><p className="eyebrow">逐条证据</p><h2>每一个结论，都能回到原始回答</h2></div><EvidenceList observations={scan.observations} /></section>
  </main>;
}
