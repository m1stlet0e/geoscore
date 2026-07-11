import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listBrandsForUser } from "@/server/brands/service";

export default async function BrandsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const brands = await listBrandsForUser(session.user.id);
  return <main className="dashboard-page"><header><div><p className="eyebrow">品牌监测</p><h1>你的品牌雷达</h1></div><Link href="/dashboard/brands/new" className="primary-button">添加品牌</Link></header><section className="brand-list">{brands.map((brand) => <Link key={brand.id} href={`/dashboard/brands/${brand.id}`}><div><h2>{brand.name}</h2><p>{brand.industry} · {brand.website}</p></div><strong>{brand.scoreSnapshots[0]?.score.toFixed(0) ?? "—"}<small>GeoScore</small></strong></Link>)}{brands.length === 0 && <p>还没有品牌，先创建一个品牌开始检测。</p>}</section></main>;
}
