import { headers } from "next/headers";
import { BookMarked, ExternalLink, Network } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadCitationSourcesForUser } from "@/server/intelligence/loader";
import { OwnedSourceButton } from "@/components/sources/owned-source-button";
import { formatAiProviderLabel } from "@/lib/growth-data";

export default async function SourcesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const groups = await loadCitationSourcesForUser(session.user.id);
  return <main className="dashboard-page intelligence-page sources-page">
    <header className="intelligence-page-header"><div><p className="eyebrow"><Network size={15} /> CITATION INTELLIGENCE</p><h1>让 AI 采信的内容，<br />不再是一团黑箱。</h1><p>按域名汇总已保存的 AI 引用，并标记哪些来源是你的官网、文章或可持续经营的内容资产。</p></div><div className="source-header-note"><BookMarked size={20} /><span>自有内容标记会真实保存到品牌资产中。</span></div></header>
    {groups.length === 0 ? <div className="compact-empty"><strong>还没有引用数据</strong><p>完成扫描后，AI 回答中的引用链接会在这里按品牌与域名汇总。</p></div> : groups.map((group) => <section key={group.brandId} className="source-brand-section"><div className="ranking-brand-heading"><div><span>{group.brandName} / CITATION MAP</span><h2>高频引用源</h2></div><small>{group.sources.length} 个已发现域名</small></div><div className="source-table-wrap"><table className="source-table"><thead><tr><th>内容来源</th><th>被引用</th><th>覆盖模型</th><th>质量分</th><th>资产归属</th></tr></thead><tbody>{group.sources.map((source) => <tr key={source.domain}><td><a href={source.representativeUrl} target="_blank" rel="noreferrer"><strong>{source.domain}</strong><span>{source.latestTitle ?? "未提供标题"}</span><ExternalLink size={13} /></a></td><td><strong>{source.citationCount}</strong><small>{source.articleCount} 篇链接</small></td><td>{source.platforms.map((platform) => <b key={platform} className="source-platform">{formatAiProviderLabel(platform)}</b>)}</td><td>{Math.round(source.averageQuality * 100)}</td><td><OwnedSourceButton brandId={group.brandId} url={source.representativeUrl} domain={source.domain} sourceId={source.ownedSourceId} /></td></tr>)}</tbody></table></div></section>)}
  </main>;
}
