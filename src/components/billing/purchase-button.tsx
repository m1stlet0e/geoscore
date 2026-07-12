"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export function PurchaseButton({ planCode }: { planCode: "STARTER" | "PRO" | "BUSINESS" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function createOrder() {
    setPending(true); setError("");
    const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planCode }) });
    const result = await response.json(); setPending(false);
    if (!response.ok) { setError(result.message ?? "下单失败"); return; }
    setOrderNo(result.order.orderNo); setQrCode(result.payment.qrCodeDataUrl);
    if (result.payment.paymentUrl.startsWith("http")) window.location.assign(result.payment.paymentUrl);
  }

  async function completeMock() {
    setPending(true);
    const response = await fetch("/api/payments/mock/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNo }) });
    const result = await response.json(); setPending(false);
    if (!response.ok) { setError(result.message ?? "支付失败"); return; }
    setOrderNo(""); router.refresh();
  }

  return <div className="purchase-action">{qrCode && <Image src={qrCode} width={220} height={220} unoptimized alt="微信支付二维码" />}{orderNo ? <button className="primary-button" onClick={completeMock} disabled={pending}>{pending ? "正在确认…" : "确认本地模拟支付"}</button> : <button className="primary-button" onClick={createOrder} disabled={pending}>{pending ? "正在创建订单…" : "选择此套餐"}</button>}{error && <p className="form-error">{error}</p>}</div>;
}
