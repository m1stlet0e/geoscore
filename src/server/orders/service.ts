import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getPlanByCode } from "@/lib/plans";
import type { PaidOrderEvent } from "@/server/payments/types";

function orderNo() {
  return `GS${Date.now()}${randomBytes(4).toString("hex")}`.slice(0, 32);
}

export async function createOrderForUser(userId: string, planCode: string, provider: string) {
  const definition = getPlanByCode(planCode);
  if (definition.code === "FREE") throw new Error("免费套餐无需支付");
  const plan = await db.plan.findUnique({ where: { code: definition.code } });
  if (!plan || !plan.active) throw new Error("套餐当前不可购买");
  return db.order.create({
    data: { userId, planId: plan.id, provider, orderNo: orderNo(), amountCents: plan.priceCents },
    include: { plan: true },
  });
}

export async function fulfillPaidOrder(event: PaidOrderEvent) {
  return db.$transaction(async (tx) => {
    const previousEvent = await tx.paymentEvent.findUnique({
      where: { provider_providerEventId: { provider: event.provider, providerEventId: event.providerEventId } },
      include: { order: true },
    });
    if (previousEvent) return previousEvent.order;

    const order = await tx.order.findUnique({ where: { orderNo: event.orderNo }, include: { plan: true } });
    if (!order) throw new Error("订单不存在");
    if (order.provider !== event.provider) throw new Error("支付渠道不匹配");
    if (order.amountCents !== event.amountCents) throw new Error("订单金额不一致");

    await tx.paymentEvent.create({
      data: {
        provider: event.provider,
        providerEventId: event.providerEventId,
        orderId: order.id,
        payload: event.rawPayload as Prisma.InputJsonValue,
      },
    });
    if (order.status === "PAID") return order;

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + 1);
    await tx.subscription.updateMany({ where: { userId: order.userId, status: "ACTIVE" }, data: { status: "CANCELED" } });
    await tx.subscription.create({
      data: { userId: order.userId, planId: order.planId, status: "ACTIVE", startsAt: now, endsAt },
    });
    const quota = await tx.quotaAccount.upsert({
      where: { userId: order.userId },
      update: { balance: { increment: order.plan.monthlyResponses } },
      create: { userId: order.userId, balance: order.plan.monthlyResponses },
    });
    await tx.quotaLedger.create({
      data: {
        userId: order.userId,
        type: "GRANT",
        amount: order.plan.monthlyResponses,
        balanceAfter: quota.balance,
        referenceType: "ORDER",
        referenceId: order.id,
        idempotencyKey: `payment:${event.provider}:${event.providerEventId}`,
      },
    });
    return tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: now, providerOrderId: event.providerOrderId },
    });
  });
}
