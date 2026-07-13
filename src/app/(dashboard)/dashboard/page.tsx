import { headers } from "next/headers";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildDashboardGrowthSnapshot } from "@/lib/growth-data";
import { OpportunityCard } from "@/components/growth/opportunity-card";

const modeLabels = {
  REAL: "真实 AI 数据",
  SIMULATED: "模拟演示数据",
} as const;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [brands, quota, activeExperimentCount, verifiedExperimentCount] = await Promise.all([
    db.brand.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        scans: {
          where: { status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
          include: {
            scoreSnapshot: true,
            opportunities: {
              where: { status: "OPEN" },
              orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
              include: {
                promptVersion: true,
                optimizationExperiment: { select: { id: true } },
              },
            },
          },
        },
      },
    }),
    db.quotaAccount.findUnique({ where: { userId: session.user.id } }),
    db.optimizationExperiment.count({
      where: {
        brand: { ownerId: session.user.id },
        status: { in: ["ACTIVE", "VERIFYING"] },
      },
    }),
    db.optimizationExperiment.count({
      where: { brand: { ownerId: session.user.id }, status: "VERIFIED" },
    }),
  ]);

  const growth = buildDashboardGrowthSnapshot(brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    scans: brand.scans.map((scan) => ({
      id: scan.id,
      status: scan.status,
      completedAt: scan.completedAt,
      dataMode: scan.dataMode,
      score: scan.scoreSnapshot?.score ?? null,
      opportunities: scan.opportunities,
    })),
  })));
  const prioritizedOpportunities = growth.opportunities.slice(0, 6);

  return (
    <main className="dashboard-page growth-dashboard">
      <header>
        <div>
          <p className="eyebrow">增长指挥台</p>
          <h1>你好，{session.user.name}</h1>
          <p>先处理高优先级 AI 推荐缺口，再用复扫实验验证每一次内容行动。</p>
        </div>
        <Link href="/dashboard/brands/new" className="primary-button">添加品牌</Link>
      </header>

      <section className="growth-kpi-grid" aria-label="账户增长指标">
        <article><span>监测品牌</span><strong>{brands.length}</strong><small>当前账户</small></article>
        <article><span>剩余额度</span><strong>{quota?.balance ?? 0}</strong><small>AI 回答次数</small></article>
        <article><span>待处理机会</span><strong>{growth.opportunities.length}</strong><small>仅统计各品牌最新扫描</small></article>
        <article><span>进行中实验</span><strong>{activeExperimentCount}</strong><small>已发布行动</small></article>
        <article><span>已验证提升</span><strong>{verifiedExperimentCount}</strong><small>完成归因复扫</small></article>
      </section>

      {brands.length === 0 ? (
        <section className="empty-panel">
          <span>01</span>
          <h2>建立第一个品牌雷达</h2>
          <p>填写官网和产品信息，系统会自动生成用户可能向 AI 提出的监测问题。</p>
          <Link href="/dashboard/brands/new" className="primary-button">创建第一个品牌</Link>
        </section>
      ) : (
        <>
          <section className="dashboard-section latest-brand-scores">
            <div className="section-heading-compact">
              <div><span className="section-index">RADAR / 01</span><h2>每个品牌的最新基线</h2></div>
              <Link href="/dashboard/brands">查看全部品牌<ArrowUpRight aria-hidden="true" size={15} /></Link>
            </div>
            <div className="latest-score-list">
              {growth.latestScans.map((scan) => (
                <Link key={scan.id} href={`/dashboard/scans/${scan.id}`}>
                  <span>{scan.brandName}</span>
                  <strong>{scan.score === null ? "—" : scan.score.toFixed(0)}</strong>
                  <small>{modeLabels[scan.dataMode]} · 查看报告</small>
                </Link>
              ))}
              {growth.latestScans.length === 0 && (
                <p className="compact-empty">品牌已经就位，完成第一次扫描后会在这里形成基线。</p>
              )}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading-compact">
              <div><span className="section-index">QUEUE / 02</span><h2>优先处理的推荐机会</h2></div>
              <small>按优先级从高到低</small>
            </div>
            {prioritizedOpportunities.length > 0 ? (
              <div className="opportunity-grid">
                {prioritizedOpportunities.map((opportunity) => (
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
              <div className="compact-empty">
                <strong>当前没有待处理机会</strong>
                <p>完成新扫描后，系统会把问题级缺口排成行动队列。</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
