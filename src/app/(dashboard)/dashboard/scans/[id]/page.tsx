import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { selectCurrentScanInsights } from "@/lib/report-data";
import { loadScanReportForUser } from "@/server/reports/loader";
import { ScoreCard } from "@/components/score/score-card";
import { EvidenceList } from "@/components/score/evidence-list";
import { OpportunityCard } from "@/components/growth/opportunity-card";

const modeLabels = {
  REAL: "真实 AI 数据",
  SIMULATED: "模拟演示数据",
} as const;

export default async function ScanReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id } = await params;
  const scan = await loadScanReportForUser(session.user.id, id);
  if (!scan || !scan.scoreSnapshot) notFound();
  const insights = selectCurrentScanInsights(scan);
  const score = scan.scoreSnapshot;
  const metrics = [
    ["品牌提及度", score.mentionScore],
    ["品牌推荐度", score.recommendationScore],
    ["竞品声量", score.shareOfVoiceScore],
    ["内容引用度", score.citationScore],
    ["品牌情感度", score.sentimentScore],
  ] as const;

  return (
    <main className="dashboard-page report-page">
      <Link href={`/dashboard/brands/${scan.brandId}`} className="back-link">← 返回 {scan.brand.name}</Link>
      <header>
        <div>
          <p className="eyebrow">AI 可见度报告</p>
          <h1>{scan.brand.name}</h1>
          <p>
            扫描 {scan.observations.length} 条已保存的 AI 回答 · {scan.completedAt?.toLocaleString("zh-CN")}
          </p>
        </div>
        <b className={`mode-stamp report-mode-stamp mode-${scan.dataMode.toLowerCase()}`}>
          {modeLabels[scan.dataMode]}
        </b>
      </header>
      {scan.dataMode === "SIMULATED" && (
        <p className="simulation-disclaimer report-disclaimer">仅用于体验闭环，不代表真实 AI 表现</p>
      )}

      <ScoreCard
        score={score.score}
        confidence={score.confidenceScore}
        provisional={score.isProvisional}
        riskLevel={score.riskLevel}
      />
      <section className="report-metrics">
        {metrics.map(([name, value]) => (
          <article key={name}>
            <span>{name}</span><strong>{value.toFixed(0)}</strong>
            <i><b style={{ width: `${Math.max(2, value)}%` }} /></i>
          </article>
        ))}
      </section>

      {insights.riskFindings.length > 0 && (
        <section className="report-section">
          <div><p className="eyebrow">本次风险发现</p><h2>需要优先核查的信息</h2></div>
          <div className="insight-grid risk-grid">
            {insights.riskFindings.map((risk) => (
              <article key={risk.id}>
                <span>{risk.level}</span><h3>{risk.title}</h3><p>{risk.description}</p><small>{risk.evidence}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="report-section">
        <div><p className="eyebrow">本次优化建议</p><h2>下一步先做什么</h2></div>
        {insights.recommendations.length > 0 ? (
          <div className="insight-grid">
            {insights.recommendations.map((item) => (
              <article key={item.id}>
                <span>影响 {item.impact} · 置信 {item.confidence} · 成本 {item.effort}</span>
                <h3>{item.title}</h3><p>{item.finding}</p><strong>{item.action}</strong><small>{item.evidence}</small>
              </article>
            ))}
          </div>
        ) : <p className="compact-empty">本次扫描没有生成额外建议。</p>}
      </section>

      <section className="report-section report-opportunities">
        <div>
          <p className="eyebrow">本次抢位机会</p>
          <h2>从报告进入增长实验</h2>
          <p>这里仅展示当前扫描生成的机会，不混入品牌历史报告。</p>
        </div>
        {insights.opportunities.length > 0 ? (
          <div className="opportunity-grid">
            {insights.opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={{
                  id: opportunity.id,
                  type: opportunity.type,
                  priority: opportunity.priority,
                  platformId: opportunity.platformId,
                  title: opportunity.title,
                  summary: opportunity.summary,
                  evidence: opportunity.evidence,
                  recommendedAction: opportunity.recommendedAction,
                  targetContentType: opportunity.targetContentType,
                  promptText: opportunity.promptVersion.text,
                  experimentId: opportunity.optimizationExperiment?.id ?? null,
                }}
              />
            ))}
          </div>
        ) : <p className="compact-empty">本次扫描没有生成抢位机会。</p>}
      </section>

      <section className="report-section">
        <div><p className="eyebrow">逐条证据</p><h2>每一个结论，都能回到原始回答</h2></div>
        <EvidenceList observations={scan.observations} />
      </section>
    </main>
  );
}
