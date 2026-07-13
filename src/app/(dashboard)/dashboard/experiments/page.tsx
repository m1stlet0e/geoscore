import { headers } from "next/headers";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const statusLabels = {
  DRAFT: "行动草案",
  ACTIVE: "进行中",
  VERIFYING: "验证中",
  VERIFIED: "已验证提升",
  INCONCLUSIVE: "结果待观察",
} as const;

const modeLabels = {
  REAL: "真实 AI 数据",
  SIMULATED: "模拟演示数据",
} as const;

export default async function ExperimentsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const experiments = await db.optimizationExperiment.findMany({
    where: { brand: { ownerId: session.user.id } },
    orderBy: { updatedAt: "desc" },
    include: {
      brand: { select: { id: true, name: true } },
      opportunity: { include: { promptVersion: true } },
      baselineScan: { select: { id: true, dataMode: true } },
      followUpScan: { select: { id: true } },
    },
  });
  const inProgressCount = experiments.filter((item) => (
    item.status === "ACTIVE" || item.status === "VERIFYING"
  )).length;
  const verifiedCount = experiments.filter((item) => item.status === "VERIFIED").length;

  return (
    <main className="dashboard-page experiments-page">
      <header>
        <div>
          <p className="eyebrow">增长实验</p>
          <h1>从行动到可验证提升</h1>
          <p>每个实验固定基线问题和数据源，把内容动作与复扫结果放在同一条证据链上。</p>
        </div>
      </header>

      <section className="experiment-summary-grid" aria-label="实验概览">
        <article><span>全部实验</span><strong>{experiments.length}</strong></article>
        <article><span>进行中实验</span><strong>{inProgressCount}</strong></article>
        <article><span>已验证提升</span><strong>{verifiedCount}</strong></article>
      </section>

      {experiments.length > 0 ? (
        <section className="experiment-list experiment-list-page">
          {experiments.map((experiment, index) => (
            <Link key={experiment.id} href={`/dashboard/experiments/${experiment.id}`}>
              <span className="experiment-row-index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <span>{experiment.brand.name} · {statusLabels[experiment.status]}</span>
                <h2>{experiment.title}</h2>
                <p>{experiment.opportunity.promptVersion.text}</p>
              </div>
              <div className="experiment-list-meta">
                <b className={`mode-stamp mode-${experiment.baselineScan.dataMode.toLowerCase()}`}>
                  {modeLabels[experiment.baselineScan.dataMode]}
                </b>
                <strong>{experiment.scoreDelta === null
                  ? "—"
                  : `${experiment.scoreDelta > 0 ? "+" : ""}${experiment.scoreDelta.toFixed(1)}`}</strong>
                <small>GeoScore 变化</small>
              </div>
              <ArrowUpRight aria-hidden="true" size={18} />
            </Link>
          ))}
        </section>
      ) : (
        <section className="empty-panel">
          <span>01</span>
          <h2>先从一个推荐机会开始</h2>
          <p>完成品牌扫描，从机会卡创建行动实验，这里会持续记录发布、验证和归因结果。</p>
          <Link href="/dashboard/brands" className="primary-button">前往品牌工作台</Link>
        </section>
      )}
    </main>
  );
}
