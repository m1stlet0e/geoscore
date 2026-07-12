export type PaymentCreation = {
  providerOrderId: string;
  paymentUrl: string;
  qrCodeUrl?: string;
};

export interface PaymentProvider {
  readonly id: string;
  createPayment(input: { orderNo: string; amountCents: number; title: string; notifyUrl: string }): Promise<PaymentCreation>;
}

export type PaidOrderEvent = {
  provider: string;
  providerEventId: string;
  providerOrderId: string;
  orderNo: string;
  amountCents: number;
  rawPayload: Record<string, unknown>;
};
