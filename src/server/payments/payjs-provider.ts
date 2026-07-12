import { createPayjsSignature } from "./signature";
import type { PaymentProvider } from "./types";

export class PayjsProvider implements PaymentProvider {
  readonly id = "payjs";
  constructor(private readonly mchid: string, private readonly key: string) {}

  async createPayment(input: { orderNo: string; amountCents: number; title: string; notifyUrl: string }) {
    const params = {
      mchid: this.mchid,
      total_fee: input.amountCents,
      out_trade_no: input.orderNo,
      body: input.title,
      notify_url: input.notifyUrl,
      attach: "geoscore-subscription",
    };
    const response = await fetch("https://payjs.cn/api/native", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])), sign: createPayjsSignature(params, this.key) }),
    });
    const payload = await response.json() as { return_code?: number; return_msg?: string; payjs_order_id?: string; code_url?: string };
    if (!response.ok || payload.return_code !== 1 || !payload.payjs_order_id || !payload.code_url) {
      throw new Error(payload.return_msg ?? "PAYJS 下单失败");
    }
    return { providerOrderId: payload.payjs_order_id, paymentUrl: payload.code_url, qrCodeUrl: payload.code_url };
  }
}
