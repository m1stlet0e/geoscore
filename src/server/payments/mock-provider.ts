import type { PaymentProvider } from "./types";

export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";
  async createPayment(input: { orderNo: string }) {
    return {
      providerOrderId: `MOCK-${input.orderNo}`,
      paymentUrl: `/dashboard/billing?mockOrder=${input.orderNo}`,
    };
  }
}
