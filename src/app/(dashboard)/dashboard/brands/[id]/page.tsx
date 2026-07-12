import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StartScanButton } from "@/components/scans/start-scan-button";
import { PromptEditor } from "@/components/brands/prompt-editor";

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id } = await params;
  const brand = await db.brand.findFirst({
    where: { id, ownerId: session.user.id },
    include: {
      aliases: true, competitors: true,
      prompts: { orderBy: { createdAt: "asc" }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
      scans: { where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 1, include: { scoreSnapshot: true } },
    },
  });
  if (!brand) notFound();
  const latest = brand.scans[0];
  return <main className="dashboard-page">
    <Link href="/dashboard/brands" className="back-link">← 返回品牌列表</Link>
    <header><div><p className="eyebrow">{brand.industry}</p><h1>{brand.name}</h1><p>{brand.product} · 面向{brand.targetAudience}</p></div><StartScanButton brandId={brand.id} /></header>
    {latest?.scoreSnapshot && <Link className="latest-score" href={`/dashboard/scans/${latest.id}`}><span>最新 GeoScore</span><strong>{latest.scoreSnapshot.score.toFixed(0)}</strong><small>查看完整报告 →</small></Link>}
    <section className="brand-meta"><article><span>官网</span><a href={brand.website} target="_blank">{brand.website}</a></article><article><span>品牌别名</span><p>{brand.aliases.map((item) => item.value).join("、") || "暂无"}</p></article><article><span>主要竞品</span><p>{brand.competitors.map((item) => item.name).join("、") || "暂无"}</p></article></section>
    <section className="prompt-section"><div><p className="eyebrow">监测问题</p><h2>AI 用户可能会这样问</h2><p>这些问题不包含你的品牌名，因此更能反映自然可见度。扫描前可以编辑或停用。</p></div><PromptEditor prompts={brand.prompts.map((prompt) => ({ id: prompt.id, category: prompt.category, active: prompt.active, text: prompt.versions[0]?.text ?? "", weight: prompt.versions[0]?.weight ?? 1 }))} /></section>
  </main>;
}
