'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type PlanOption = 'PRO' | 'GROWTH';

const PLAN_META: Record<PlanOption, { label: string; price: string; desc: string }> = {
  PRO: {
    label: '专业版 PRO',
    price: '¥299',
    desc: '50 次扫描/月 · 完整 Citation & Gap 分析',
  },
  GROWTH: {
    label: '增长版 GROWTH',
    price: '¥799',
    desc: '200 次扫描/月 · 内容生成与高级报告',
  },
};

export function UpgradeModal({
  isOpen,
  onClose,
  defaultPlan = 'PRO',
}: {
  isOpen: boolean;
  onClose: () => void;
  defaultPlan?: PlanOption;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>(defaultPlan);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setQrCodeUrl(null);
    setOrderNo(null);
    setPaymentStatus('PENDING');
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const handleCreateOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, paymentMethod: 'wechat' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '创建订单失败');
      }

      const qr = data.codeUrl || data.paymentUrl || data.cashierUrl;
      if (!qr) {
        throw new Error('未获取到支付二维码，请检查 Payjs 配置');
      }

      setQrCodeUrl(qr);
      setOrderNo(data.orderNo);
      setPaymentStatus('PENDING');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!qrCodeUrl || !orderNo || paymentStatus !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/orders/${orderNo}`);
        if (!res.ok) return;
        const data = await res.json();
        const status = data.order?.status;
        if (status === 'PAID') {
          setPaymentStatus('PAID');
          setTimeout(() => {
            onClose();
            router.refresh();
          }, 2000);
        }
      } catch {
        // 轮询静默失败，下次继续
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [qrCodeUrl, orderNo, paymentStatus, onClose, router]);

  if (!isOpen) return null;

  const meta = PLAN_META[selectedPlan];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 text-neutral-400 hover:text-neutral-900"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
            <Sparkles className="h-8 w-8 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-black text-neutral-900">升级 {meta.label}</h3>
          <p className="mt-2 text-sm text-neutral-500">{meta.desc}</p>

          {!qrCodeUrl ? (
            <div className="mt-8 space-y-4">
              <div className="flex gap-2">
                {(Object.keys(PLAN_META) as PlanOption[]).map((plan) => (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-bold transition ${
                      selectedPlan === plan
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {PLAN_META[plan].label}
                  </button>
                ))}
              </div>

              <div className="relative rounded-2xl border-2 border-indigo-600 bg-indigo-50/50 p-4">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  推荐
                </span>
                <div className="text-3xl font-black text-neutral-900">
                  {meta.price}
                  <span className="text-sm font-medium text-neutral-500"> / 月</span>
                </div>
              </div>

              {error && (
                <p className="text-sm font-medium text-rose-600">{error}</p>
              )}

              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-indigo-600/20 transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : '微信安全支付'}
              </button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center">
              {paymentStatus === 'PAID' ? (
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="mb-4 h-20 w-20 text-emerald-500" />
                  <p className="text-lg font-black text-emerald-600">
                    支付成功！正在为您配置额度…
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border bg-white p-4 shadow-sm">
                    <QRCodeSVG value={qrCodeUrl} size={180} level="H" />
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm font-bold text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    请使用微信扫码支付
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">订单号: {orderNo}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
