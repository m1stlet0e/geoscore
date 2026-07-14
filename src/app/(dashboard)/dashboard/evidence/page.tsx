import Link from "next/link";
import { headers } from "next/headers";
import { Download, FileSearch, Link2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadEvidenceSnapshotsForUser } from "@/server/intelligence/loader";
import { formatAiProviderLabel } from "@/lib/growth-data";

export default async function EvidencePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const observations = await loadEvidenceSnapshotsForUser(session.user.id);
  return <main className="dashboard-page intelligence-page evidence-page">
    <header className="intelligence-page-header"><div><p className="eyebrow"><FileSearch size={15} /> EVIDENCE VAULT</p><h1>每一个结论，<br />都可以回到原始回答。</h1><p>这里保存扫描中的问题、模型回答、品牌提及和引用；可按扫描导出标准 JSON 证据包，供市场、管理层和公关复核。</p></div></header>
    {observations.length === 0 ? <div className="compact-empty"><strong>证据库暂时为空</strong><p>完成扫描后，原始回答和引用会自动落库。</p></div> : <section className="evidence-vault"><div className="evidence-vault-topline"><span>最近 {observations.length} 条原始回答</span><small>模拟演示数据会明确标记，不能当作真实 AI 表现。</small></div>{observations.map((observation) => <details key={observation.id} className="evidence-vault-item"><summary><div className="evidence-vault-title"><b>{observation.scan.brand.name}</b><span>{formatAiProviderLabel(observation.platformId)} · {observation.promptVersion.text}</span></div><div className="evidence-vault-meta"><i className={`mode-stamp mode-${observation.scan.dataMode.toLowerCase()}`}>{observation.scan.dataMode === "REAL" ? "真实 AI" : "模拟演示"}</i><strong>{observation.mentions.some((mention) => mention.isTarget) ? "已提及" : "未提及"}</strong></div></summary><div className="evidence-vault-body"><div><span>原始回答</span><p>{observation.rawResponse}</p></div><div className="evidence-detail-grid"><article><span>品牌提及</span>{observation.mentions.length ? observation.mentions.map((mention) => <p key={mention.id}>{mention.isTarget ? "目标品牌" : mention.brandName} · {mention.position ? `第 #${mention.position}` : "未排序"} · {mention.sentiment}</p>) : <p>未识别到品牌实体</p>}</article><article><span>引用链接</span>{observation.citations.length ? observation.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer"><Link2 size={13} /> {citation.domain}</a>) : <p>本条回答未提供可识别引用</p>}</article></div><div className="evidence-actions"><Link href={`/dashboard/scans/${observation.scan.id}`}>打开扫描报告</Link><a href={`/api/scans/${observation.scan.id}/snapshot`} download><Download size={15} /> 下载本次 JSON 证据包</a></div></div></details>)}</section>}
  </main>;
}
