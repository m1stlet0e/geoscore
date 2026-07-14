import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, BarChart3, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadRankingsForUser } from "@/server/intelligence/loader";
import { formatAiProviderLabel } from "@/lib/growth-data";

function platformNames(rows: Awaited<ReturnType<typeof loadRankingsForUser>>[number]["rows"]) {
  return [...new Set(rows.flatMap((row) => Object.keys(row.platforms)))];
}

export default async function RankingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const groups = await loadRankingsForUser(session.user.id);
  return (
    <main className="dashboard-page intelligence-page rankings-page">
      <header className="intelligence-page-header">
        <div><p className="eyebrow"><BarChart3 size={15} /> RANKING MATRIX</p><h1>哪个问题、哪个模型，<br />你的品牌正在输给谁？</h1><p>矩阵只使用各品牌最近一次已完成扫描的真实落库结果；“未提及”不被伪装成排名。</p></div>
        <Link href="/dashboard/evidence" className="secondary-button"><Download size={16} /> 下载原始证据</Link>
      </header>
      {groups.length === 0 ? <div className="compact-empty"><strong>还没有排名数据</strong><p>先完成一次品牌扫描。</p></div> : groups.map(({ brand, scan, rows }) => {
        const platforms = platformNames(rows);
        return <section key={scan.id} className="ranking-brand-section">
          <div className="ranking-brand-heading"><div><span>{brand.name} / LATEST SCAN</span><h2>问题级排名矩阵</h2></div><Link href={`/dashboard/scans/${scan.id}`}>查看原报告 <ArrowRight size={15} /></Link></div>
          <div className="ranking-summary-strip"><span>监测问题 {rows.length}</span><span>扫描时间 {scan.completedAt?.toLocaleString("zh-CN")}</span><span>数据模式 {scan.dataMode === "REAL" ? "真实 AI" : "模拟演示"}</span></div>
          <div className="rank-matrix-wrap"><table className="rank-matrix"><thead><tr><th>用户问题</th><th>提及率</th><th>头号竞品</th>{platforms.map((platform) => <th key={platform}>{formatAiProviderLabel(platform)}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.prompt}><td><strong>{row.prompt}</strong></td><td>{Math.round(row.mentionRate * 100)}%</td><td>{row.primaryCompetitor ?? "—"}</td>{platforms.map((platform) => { const cell = row.platforms[platform]; return <td key={platform}><span className={`rank-cell rank-${cell?.state.toLowerCase() ?? "missing"}`}>{cell?.state === "RANKED" ? `#${cell.rank}` : cell?.state === "MENTIONED" ? "已提及" : "未提及"}</span>{cell?.competitor && <small>{cell.competitor}</small>}</td>; })}</tr>)}</tbody></table></div>
        </section>;
      })}
    </main>
  );
}
