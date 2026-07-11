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
    <main className="dashboard-empty">
      <Link href="/" className="brand-mark"><span>G</span>eoScore</Link>
      <div><p className="eyebrow">品牌控制台</p><h1>你好，{session.user.name}</h1><p>你当前有 {brandCount} 个品牌，剩余 {quota?.balance ?? 0} 次 AI 回答额度。</p><Link href="/dashboard/brands/new" className="primary-button">创建第一个品牌</Link></div>
    </main>
  );
}
