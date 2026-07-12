import QRCode from "qrcode";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createOrderForUser } from "@/server/orders/service";
import { getPaymentProvider } from "@/server/payments";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const parsed = z.object({ planCode: z.enum(["STARTER", "PRO", "BUSINESS"]) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "套餐不正确" }, { status: 400 });
  try {
    const provider = getPaymentProvider();
    const order = await createOrderForUser(session.user.id, parsed.data.planCode, provider.id);
    const payment = await provider.createPayment({
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      title: `GeoScore ${order.plan.name}`,
      notifyUrl: process.env.PAYJS_NOTIFY_URL ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/payjs/notify`,
    });
    await db.order.update({ where: { id: order.id }, data: { providerOrderId: payment.providerOrderId } });
    const qrCodeDataUrl = payment.qrCodeUrl ? await QRCode.toDataURL(payment.qrCodeUrl, { width: 280, margin: 1 }) : null;
    return NextResponse.json({ order: { orderNo: order.orderNo, amountCents: order.amountCents, status: order.status }, payment: { ...payment, qrCodeDataUrl } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "订单创建失败" }, { status: 400 });
  }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ message: "请先登录" }, { status: 401 });
  const orders = await db.order.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { plan: true } });
  return NextResponse.json({ orders });
}
