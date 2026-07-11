import type { RiskLevel } from "@/generated/prisma/enums";

export function ScoreCard({ score, confidence, provisional, riskLevel }: { score: number; confidence: number; provisional: boolean; riskLevel: RiskLevel }) {
  const riskLabel = riskLevel === "CRITICAL" ? "高风险" : riskLevel === "WARNING" ? "需要关注" : "信息正常";
  return <section className="report-score-card">
    <div className="report-score"><strong>{Math.round(score)}</strong><small>/ 100</small></div>
    <div><p className="eyebrow">GeoScore</p><h2>{score >= 70 ? "品牌已建立 AI 认知" : score >= 40 ? "品牌可见度仍有提升空间" : "品牌在 AI 中几乎不可见"}</h2><div className="score-badges"><span>{provisional ? "初步评分" : "正式评分"}</span><span>置信度 {Math.round(confidence)}</span><span data-risk={riskLevel}>{riskLabel}</span></div></div>
  </section>;
}
