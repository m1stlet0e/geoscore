import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatAiProviderLabel } from "@/lib/growth-data";
import { ExperimentPanel } from "@/components/growth/experiment-panel";

const opportunityLabels = {
  MENTION_GAP: "提及缺口",
  COMPETITOR_ADVANTAGE: "竞品领先",
  CITATION_GAP: "引用缺口",
  BRAND_RISK: "品牌风险",
} as const;

export default async function ExperimentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id } = await params;
  const experiment = await db.optimizationExperiment.findFirst({
    where: { id, brand: { ownerId: session.user.id } },
    include: {
      brand: { select: { id: true, name: true } },
      opportunity: { include: { promptVersion: true } },
      baselineScan: { select: { id: true, dataMode: true } },
      followUpScan: { select: { id: true } },
    },
  });
  if (!experiment) notFound();
  const referenceTimeMs = new Date().getTime();

  return (
    <main className="dashboard-page experiment-detail-page">
      <Link href="/dashboard/experiments" className="back-link">← 返回增长实验</Link>
      <header>
        <div>
          <p className="eyebrow">{experiment.brand.name} · 实验详情</p>
          <h1>验证一次增长行动</h1>
          <p>基线与复扫严格复用同一组问题、数据源和采样次数，服务端负责最终校验。</p>
        </div>
      </header>

      <section className="experiment-origin">
        <div>
          <span>原始机会</span>
          <strong>{opportunityLabels[experiment.opportunity.type]}</strong>
        </div>
        <div>
          <span>监测问题</span>
          <p>{experiment.opportunity.promptVersion.text}</p>
        </div>
        <div>
          <span>平台与优先级</span>
          <p>
            {formatAiProviderLabel(experiment.opportunity.platformId)} · 优先级 {experiment.opportunity.priority}
          </p>
        </div>
        <div>
          <span>基线证据</span>
          <p>{experiment.opportunity.evidence}</p>
        </div>
      </section>

      <ExperimentPanel key={experiment.updatedAt.toISOString()} referenceTimeMs={referenceTimeMs} experiment={{
        id: experiment.id,
        updatedAt: experiment.updatedAt.toISOString(),
        title: experiment.title,
        hypothesis: experiment.hypothesis,
        actionPlan: experiment.actionPlan,
        targetUrl: experiment.targetUrl,
        status: experiment.status,
        nextCheckAt: experiment.nextCheckAt?.toISOString() ?? null,
        verificationLeaseExpiresAt: experiment.verificationLeaseExpiresAt?.toISOString() ?? null,
        resultSummary: experiment.resultSummary,
        scoreDelta: experiment.scoreDelta,
        mentionDelta: experiment.mentionDelta,
        recommendationDelta: experiment.recommendationDelta,
        citationDelta: experiment.citationDelta,
        baselineScanId: experiment.baselineScan.id,
        followUpScanId: experiment.followUpScan?.id ?? null,
        baselineDataMode: experiment.baselineScan.dataMode,
      }} />
    </main>
  );
}
