import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const [brandCount, quota] = await Promise.all([
    db.brand.count({ where: { ownerId: session.user.id } }),
    db.quotaAccount.findUnique({ where: { userId: session.user.id } }),
  ]);
  return (
    <main className="dashboard-page">
      <header><div><p className="eyebrow">品牌控制台</p><h1>你好，{session.user.name}</h1></div><Link href="/dashboard/brands/new" className="primary-button">添加品牌</Link></header>
      <section className="stats-grid"><article><span>监测品牌</span><strong>{brandCount}</strong><small>当前账户</small></article><article><span>剩余额度</span><strong>{quota?.balance ?? 0}</strong><small>AI 回答次数</small></article><article><span>数据状态</span><strong>{brandCount ? "待扫描" : "未开始"}</strong><small>创建品牌后生成报告</small></article></section>
      {brandCount === 0 && <section className="empty-panel"><span>01</span><h2>建立第一个品牌雷达</h2><p>填写官网和产品信息，系统会自动生成用户可能向 AI 提出的问题。</p><Link href="/dashboard/brands/new" className="primary-button">创建第一个品牌</Link></section>}
    </main>
  );
}
