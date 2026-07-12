import { MockPaymentProvider } from "./mock-provider";
import { PayjsProvider } from "./payjs-provider";
import type { PaymentProvider } from "./types";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "payjs") return new PayjsProvider(required("PAYJS_MCHID"), required("PAYJS_KEY"));
  return new MockPaymentProvider();
}
