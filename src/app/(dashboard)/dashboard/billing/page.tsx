import { headers } from "next/headers";
import { PurchaseButton } from "@/components/billing/purchase-button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAN_CATALOG, PLAN_CODES } from "@/lib/plans";

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const [quota, subscription, orders] = await Promise.all([
    db.quotaAccount.findUnique({ where: { userId: session.user.id } }),
    db.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        endsAt: { gt: new Date() },
      },
      orderBy: { endsAt: "desc" },
      include: { plan: true },
    }),
    db.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { plan: true },
    }),
  ]);

  return (
    <main className="dashboard-page billing-page">
      <header>
        <div>
          <p className="eyebrow">增长套餐与回答额度</p>
          <h1>为下一轮扫描与增长验证补充额度</h1>
          <p>
            当前套餐：{subscription?.plan.name ?? "免费体检"} · 剩余 {quota?.balance ?? 0} 次 AI 回答
          </p>
          <p className="billing-manual-note">
            扫描和实验复测均由你手动发起；复测会沿用基线问题、AI 数据源和采样次数。
          </p>
        </div>
      </header>

      <section className="pricing-grid" aria-label="付费套餐">
        {PLAN_CODES.filter((code) => code !== "FREE").map((code) => {
          const plan = PLAN_CATALOG[code];
          return (
            <article
              key={code}
              aria-label={`${plan.name}套餐`}
              data-plan-code={code}
            >
              <p className="pricing-plan-name">{plan.name}</p>
              <h2><small>¥</small>{plan.priceCents / 100}<span>/月</span></h2>
              <p className="pricing-plan-outcome">
                最多管理 {plan.maxBrands} 个品牌，持续积累机会、实验和前后变化证据。
              </p>
              <ul aria-label={`${plan.name}能力`}>
                {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <p className="pricing-quota-note">
                本次购买发放 {plan.monthlyResponses.toLocaleString()} 次回答额度
              </p>
              <PurchaseButton planCode={code} />
            </article>
          );
        })}
      </section>

      <section className="order-list">
        <h2>最近订单</h2>
        {orders.length === 0 && <p className="empty-order-note">完成购买后，订单和到账结果会保存在这里。</p>}
        {orders.map((order) => (
          <div key={order.id}>
            <span>{order.orderNo}</span>
            <b>{order.plan.name}</b>
            <strong>¥{(order.amountCents / 100).toFixed(2)}</strong>
            <i data-status={order.status}>{order.status === "PAID" ? "已支付" : "待支付"}</i>
          </div>
        ))}
      </section>
    </main>
  );
}
