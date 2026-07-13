import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  groupScoreTrends,
  getScanRecoveryAction,
  selectBrandWorkOpportunities,
  selectLatestUnfinishedScan,
} from "@/lib/growth-data";
import { StartScanButton } from "@/components/scans/start-scan-button";
import { ResumeScanButton } from "@/components/scans/resume-scan-button";
import { PromptEditor } from "@/components/brands/prompt-editor";
import { ScoreTrend } from "@/components/growth/score-trend";
import { OpportunityCard } from "@/components/growth/opportunity-card";

const modeLabels = {
  REAL: "真实 AI 数据",
  SIMULATED: "模拟演示数据",
} as const;

const experimentStatusLabels = {
  DRAFT: "行动草案",
  ACTIVE: "进行中",
  VERIFYING: "验证中",
  VERIFIED: "已验证提升",
  INCONCLUSIVE: "结果待观察",
} as const;

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id } = await params;
  const brand = await db.brand.findFirst({
    where: { id, ownerId: session.user.id },
    include: {
      aliases: true,
      competitors: true,
      prompts: {
        orderBy: { createdAt: "asc" },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      },
      scans: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 8,
        include: { scoreSnapshot: true },
      },
    },
  });
  if (!brand) notFound();

  const latest = brand.scans[0];
  const [quota, opportunities, recentExperiments, latestScan] = await Promise.all([
    db.quotaAccount.findUnique({ where: { userId: session.user.id } }),
    db.opportunity.findMany({
      where: latest
        ? {
            brandId: brand.id,
            OR: [
              { status: "IN_PROGRESS" },
              { status: "OPEN", scanId: latest.id },
            ],
          }
        : { brandId: brand.id, status: "IN_PROGRESS" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        promptVersion: true,
        optimizationExperiment: { select: { id: true } },
      },
    }),
    db.optimizationExperiment.findMany({
      where: { brandId: brand.id },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        opportunity: { include: { promptVersion: true } },
        baselineScan: { select: { dataMode: true } },
      },
    }),
    db.scan.findFirst({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const latestUnfinished = selectLatestUnfinishedScan(latestScan ? [latestScan] : []);
  const recoveryAction = latestUnfinished
    ? getScanRecoveryAction(latestUnfinished)
    : null;
  const workOpportunities = selectBrandWorkOpportunities(latest?.id, opportunities);
  const trends = groupScoreTrends(brand.scans.map((scan) => ({
    id: scan.id,
    dataMode: scan.dataMode,
    completedAt: scan.completedAt,
    score: scan.scoreSnapshot?.score ?? null,
  })));
  const activePromptCount = brand.prompts.filter((prompt) => prompt.active).length;

  return (
    <main className="dashboard-page brand-workbench">
      <Link href="/dashboard/brands" className="back-link">← 返回品牌列表</Link>
      <header>
        <div>
          <p className="eyebrow">{brand.industry} · 增长工作台</p>
          <h1>{brand.name}</h1>
          <p>{brand.product} · 面向{brand.targetAudience}</p>
        </div>
        {latest?.scoreSnapshot && (
          <Link className="brand-score-ticket" href={`/dashboard/scans/${latest.id}`}>
            <span>最新 GeoScore</span>
            <strong>{latest.scoreSnapshot.score.toFixed(0)}</strong>
            <small>{modeLabels[latest.dataMode]} · 查看报告</small>
          </Link>
        )}
      </header>

      <section className="brand-meta">
        <article><span>官网</span><a href={brand.website} target="_blank" rel="noreferrer">{brand.website}</a></article>
        <article><span>品牌别名</span><p>{brand.aliases.map((item) => item.value).join("、") || "暂无"}</p></article>
        <article><span>主要竞品</span><p>{brand.competitors.map((item) => item.name).join("、") || "暂无"}</p></article>
      </section>

      {latestUnfinished && (
        <section className={`unfinished-scan unfinished-${latestUnfinished.status.toLowerCase()}`}>
          <div>
            <span className="section-index">SCAN / RECOVERY</span>
            <h2>{latestUnfinished.verificationExperimentId
              ? "最近一次实验验证尚未形成结果"
              : "最近一次扫描尚未形成报告"}</h2>
            {latestUnfinished.status === "FAILED" ? (
              <p>{latestUnfinished.verificationExperimentId
                ? "验证扫描失败后额度已自动退还。请回到原实验重新发起验证。"
                : "扫描失败后额度已自动退还。请核对数据源配置，再发起一轮新扫描。"}</p>
            ) : (
              <p>{latestUnfinished.verificationExperimentId
                ? "验证扫描必须从原实验恢复，确保归因结果和实验状态一起完成。"
                : "扫描使用同一笔已扣额度，继续执行不会创建新扫描或重复扣费。"}</p>
            )}
          </div>
          {recoveryAction?.kind === "EXPERIMENT" ? (
            <Link
              className="primary-button"
              href={`/dashboard/experiments/${recoveryAction.experimentId}`}
            >
              {latestUnfinished.status === "FAILED" ? "返回实验重新验证" : "返回实验恢复验证"}
            </Link>
          ) : recoveryAction?.kind === "SCAN" ? (
            <ResumeScanButton
              scanId={latestUnfinished.id}
              status={latestUnfinished.status === "RUNNING" ? "RUNNING" : "PENDING"}
            />
          ) : (
            <div className="failed-scan-note">
              <CircleAlert aria-hidden="true" size={19} />
              <strong>已退款，请新建扫描</strong>
              {latestUnfinished.errorMessage && <small>{latestUnfinished.errorMessage}</small>}
            </div>
          )}
        </section>
      )}

      <section className="scan-workbench-grid">
        <StartScanButton
          brandId={brand.id}
          activePromptCount={activePromptCount}
          quotaBalance={quota?.balance ?? 0}
        />
      </section>

      <section className="dashboard-section">
        <div className="section-heading-compact">
          <div><span className="section-index">SIGNAL / 02</span><h2>评分趋势分轨</h2></div>
          <small>最近 8 次已完成扫描</small>
        </div>
        <div className="trend-grid">
          <ScoreTrend mode="REAL" points={trends.REAL} />
          <ScoreTrend mode="SIMULATED" points={trends.SIMULATED} />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading-compact">
          <div><span className="section-index">OPPORTUNITY / 03</span><h2>当前抢位机会</h2></div>
          <small>最新 OPEN + 全部 IN_PROGRESS</small>
        </div>
        {workOpportunities.length > 0 ? (
          <div className="opportunity-grid">
            {workOpportunities.map((opportunity) => (
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
        ) : (
          <div className="compact-empty"><strong>暂无可执行机会</strong><p>完成新扫描后，这里会出现按问题拆分的推荐增长行动。</p></div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading-compact">
          <div><span className="section-index">EXPERIMENT / 04</span><h2>最近增长实验</h2></div>
          <Link href="/dashboard/experiments">查看全部实验<ArrowUpRight aria-hidden="true" size={15} /></Link>
        </div>
        {recentExperiments.length > 0 ? (
          <div className="experiment-list">
            {recentExperiments.map((experiment) => (
              <Link key={experiment.id} href={`/dashboard/experiments/${experiment.id}`}>
                <div>
                  <span>{experimentStatusLabels[experiment.status]}</span>
                  <h3>{experiment.title}</h3>
                  <p>{experiment.opportunity.promptVersion.text}</p>
                </div>
                <div className="experiment-list-meta">
                  <b className={`mode-stamp mode-${experiment.baselineScan.dataMode.toLowerCase()}`}>
                    {modeLabels[experiment.baselineScan.dataMode]}
                  </b>
                  <strong>{experiment.scoreDelta === null ? "—" : `${experiment.scoreDelta > 0 ? "+" : ""}${experiment.scoreDelta.toFixed(1)}`}</strong>
                  <small>GeoScore 变化</small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="compact-empty"><strong>还没有实验</strong><p>从上方机会卡创建第一个增长实验。</p></div>
        )}
      </section>

      <section className="prompt-section prompt-section-secondary">
        <div>
          <p className="eyebrow">监测问题</p>
          <h2>维护扫描问题</h2>
          <p>这些问题不包含品牌名，更能反映自然可见度。扫描前可以编辑或停用。</p>
        </div>
        <PromptEditor prompts={brand.prompts.map((prompt) => ({
          id: prompt.id,
          category: prompt.category,
          active: prompt.active,
          text: prompt.versions[0]?.text ?? "",
          weight: prompt.versions[0]?.weight ?? 1,
        }))} />
      </section>
    </main>
  );
}
