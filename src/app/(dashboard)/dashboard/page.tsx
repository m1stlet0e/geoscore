import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, ArrowUpRight, Radar, ShieldAlert, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadIntelligenceOverviewForUser } from "@/server/intelligence/loader";

const priorityCopy = {
  P0: "立即处理",
  P1: "本周复盘",
  P2: "持续观察",
} as const;

const modeLabels = { REAL: "真实 AI 数据", SIMULATED: "模拟演示数据" } as const;

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const intelligence = await loadIntelligenceOverviewForUser(session.user.id);

  return (
    <main className="dashboard-page intelligence-page">
      <header className="intelligence-hero">
        <div>
          <p className="eyebrow"><Radar size={15} /> GEO 情报中心 / TODAY</p>
          <h1>今天，先处理<br />会让品牌失去推荐的信号。</h1>
          <p>把扫描中的未提及、竞品领先、负面口碑和引用缺口，按处理优先级放到一张作战清单。</p>
        </div>
        <div className="intelligence-hero-action">
          <span>当前账户</span>
          <strong>{session.user.name}</strong>
          <Link href="/dashboard/brands/new" className="primary-button">添加监测品牌 <ArrowRight size={16} /></Link>
        </div>
      </header>

      <section className="intelligence-kpis" aria-label="今日情报指标">
        <article><span>监测品牌</span><strong>{intelligence.summary.brandCount}</strong><small>当前账户</small></article>
        <article><span>剩余额度</span><strong>{intelligence.summary.quotaBalance}</strong><small>AI 回答次数</small></article>
        <article><span>平均 GeoScore</span><strong>{intelligence.summary.averageScore === null ? "—" : intelligence.summary.averageScore.toFixed(0)}</strong><small>仅汇总各品牌最新报告</small></article>
        <article data-priority="P0"><span>P0 紧急信号</span><strong>{intelligence.summary.p0Count}</strong><small>未提及 / 高风险</small></article>
        <article><span>进行中实验</span><strong>{intelligence.summary.activeExperiments}</strong><small>等待复扫归因</small></article>
      </section>

      {intelligence.latestScans.length === 0 ? (
        <section className="intelligence-empty">
          <Sparkles aria-hidden="true" size={26} />
          <div><span>FIRST SIGNAL</span><h2>先建立一条品牌信号基线。</h2><p>创建品牌、生成 20 个真实用户问题并完成扫描后，这里会自动按 P0/P1/P2 排出今天的行动清单。</p></div>
          <Link href="/dashboard/brands/new" className="primary-button">创建第一个品牌</Link>
        </section>
      ) : (
        <>
          <section className="intelligence-section">
            <div className="intelligence-section-heading">
              <div><span>01 / ACTION QUEUE</span><h2>优先处理的品牌信号</h2></div>
              <p>P0 必须先处理；P1 纳入本周复盘；P2 作为内容增长线索持续观察。</p>
            </div>
            {intelligence.alerts.length ? (
              <div className="action-alert-list">
                {intelligence.alerts.slice(0, 12).map((alert, index) => (
                  <Link key={alert.id} href={alert.scanId ? `/dashboard/scans/${alert.scanId}` : "/dashboard/brands"} className="action-alert-card">
                    <div className={`priority-chip priority-${alert.priority.toLowerCase()}`}>{alert.priority}<small>{priorityCopy[alert.priority]}</small></div>
                    <span className="alert-index">{String(index + 1).padStart(2, "0")}</span>
                    <div><b>{alert.source === "RISK" ? "品牌风险" : "增长机会"}</b><h3>{alert.title}</h3><p>{alert.summary}</p></div>
                    <ArrowUpRight aria-hidden="true" size={18} />
                  </Link>
                ))}
              </div>
            ) : <div className="compact-empty"><strong>当前没有待处理信号</strong><p>完成下一次扫描后，系统会根据品牌提及、竞品、引用和风险生成行动队列。</p></div>}
          </section>

          <section className="intelligence-section intelligence-watchlist">
            <div className="intelligence-section-heading">
              <div><span>02 / BRAND WATCHLIST</span><h2>品牌信号板</h2></div>
              <Link href="/dashboard/rankings">查看问题级排名矩阵 <ArrowRight size={15} /></Link>
            </div>
            <div className="brand-signal-grid">
              {intelligence.latestScans.map((scan) => (
                <Link key={scan.id} href={`/dashboard/scans/${scan.id}`} className="brand-signal-card">
                  <div><span>{scan.brand.name}</span><b className={`mode-stamp mode-${scan.dataMode.toLowerCase()}`}>{modeLabels[scan.dataMode]}</b></div>
                  <strong>{scan.scoreSnapshot?.score.toFixed(0) ?? "—"}</strong>
                  <p>GeoScore · {scan.completedAt?.toLocaleString("zh-CN")}</p>
                  <small>打开报告，查看原始回答与本次机会 <ArrowUpRight aria-hidden="true" size={13} /></small>
                </Link>
              ))}
            </div>
          </section>

          <section className="intelligence-footer-grid">
            <Link href="/dashboard/reputation"><ShieldAlert aria-hidden="true" size={22} /><span>口碑预警</span><p>把负面评价和风险证据按平台、问题回溯。</p><ArrowRight aria-hidden="true" size={16} /></Link>
            <Link href="/dashboard/sources"><Sparkles aria-hidden="true" size={22} /><span>引用溯源</span><p>找到被 AI 采信的内容源，标记你的自有资产。</p><ArrowRight aria-hidden="true" size={16} /></Link>
          </section>
        </>
      )}
    </main>
  );
}
