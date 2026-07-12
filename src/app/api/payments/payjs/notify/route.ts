import { fulfillPaidOrder } from "@/server/orders/service";
import { verifyPayjsSignature } from "@/server/payments/signature";

export async function POST(request: Request) {
  const form = await request.formData();
  const payload = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  const key = process.env.PAYJS_KEY;
  if (!key || !verifyPayjsSignature(payload, key) || payload.return_code !== "1") {
    return new Response("fail", { status: 400 });
  }
  try {
    await fulfillPaidOrder({
      provider: "payjs",
      providerEventId: payload.transaction_id || payload.payjs_order_id,
      providerOrderId: payload.payjs_order_id,
      orderNo: payload.out_trade_no,
      amountCents: Number(payload.total_fee),
      rawPayload: payload,
    });
    return new Response("success");
  } catch {
    return new Response("fail", { status: 400 });
  }
}
