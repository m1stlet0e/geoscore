import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_CATALOG, PLAN_CODES } from "@/lib/plans";
import { PurchaseButton } from "@/components/billing/purchase-button";

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const quota = await db.quotaAccount.findUnique({ where: { userId: session.user.id } });
  const subscription = await db.subscription.findFirst({ where: { userId: session.user.id, status: "ACTIVE", endsAt: { gt: new Date() } }, orderBy: { endsAt: "desc" }, include: { plan: true } });
  const orders = await db.order.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 5, include: { plan: true } });
  return <main className="dashboard-page billing-page"><header><div><p className="eyebrow">套餐与额度</p><h1>按真实使用量付费</h1><p>当前套餐：{subscription?.plan.name ?? "免费体检"} · 剩余 {quota?.balance ?? 0} 次 AI 回答</p></div></header><section className="pricing-grid">{PLAN_CODES.filter((code) => code !== "FREE").map((code) => { const plan = PLAN_CATALOG[code]; return <article key={code}><p>{plan.name}</p><h2><small>¥</small>{plan.priceCents / 100}<span>/月</span></h2><strong>{plan.monthlyResponses.toLocaleString()} 次 AI 回答</strong><ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><PurchaseButton planCode={code} /></article>; })}</section><section className="order-list"><h2>最近订单</h2>{orders.map((order) => <div key={order.id}><span>{order.orderNo}</span><b>{order.plan.name}</b><strong>¥{(order.amountCents / 100).toFixed(2)}</strong><i data-status={order.status}>{order.status === "PAID" ? "已支付" : "待支付"}</i></div>)}</section></main>;
}
