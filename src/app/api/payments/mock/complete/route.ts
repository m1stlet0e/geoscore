import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/server/orders/service";

export async function POST(request: Request) {
  if (process.env.PAYMENT_PROVIDER !== "mock") return NextResponse.json({ message: "模拟支付未启用" }, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = z.object({ orderNo: z.string().min(10) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "订单号不正确" }, { status: 400 });
  const order = await db.order.findFirst({ where: { orderNo: parsed.data.orderNo, userId: session.user.id } });
  if (!order) return NextResponse.json({ message: "订单不存在" }, { status: 404 });
  const paid = await fulfillPaidOrder({
    provider: "mock",
    providerEventId: `mock-paid:${order.orderNo}`,
    providerOrderId: order.providerOrderId ?? `MOCK-${order.orderNo}`,
    orderNo: order.orderNo,
    amountCents: order.amountCents,
    rawPayload: { local: true, completedBy: session.user.id },
  });
  return NextResponse.json({ order: paid });
}
