'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Scan,
  MessageSquare,
  Link2,
  GitCompareArrows,
  FileEdit,
  FileBarChart,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE';

interface Subscription {
  id: string;
  plan: Plan;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
}

interface Order {
  id: string;
  orderNo: string;
  plan: Plan;
  amount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  paidAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Quota {
  id: string;
  type: string;
  used: number;
  remaining: number;
  total: number;
  period: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAN_STYLE: Record<Plan, { label: string; cls: string; price: string }> = {
  FREE: { label: '免费版', cls: 'border-neutral-300 bg-neutral-100 text-neutral-700', price: '¥0/月' },
  PRO: { label: '专业版', cls: 'border-indigo-500/30 bg-indigo-50 text-indigo-600', price: '¥299/月' },
  GROWTH: { label: '增长版', cls: 'border-violet-500/30 bg-violet-50 text-violet-600', price: '¥799/月' },
  ENTERPRISE: { label: '企业版', cls: 'border-amber-500/30 bg-amber-50 text-amber-600', price: '¥2999/月' },
};

const QUOTA_META: Record<string, { label: string; icon: React.ReactNode }> = {
  SCAN: { label: '扫描次数', icon: <Scan className="h-4 w-4" /> },
  PROMPT: { label: 'Prompt 数量', icon: <MessageSquare className="h-4 w-4" /> },
  CITATION_ANALYSIS: { label: '引用分析', icon: <Link2 className="h-4 w-4" /> },
  GAP_ANALYSIS: { label: '缺口分析', icon: <GitCompareArrows className="h-4 w-4" /> },
  CONTENT_GENERATE: { label: '内容生成', icon: <FileEdit className="h-4 w-4" /> },
  REPORT_GENERATE: { label: '报告生成', icon: <FileBarChart className="h-4 w-4" /> },
};

const ORDER_STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '待支付', cls: 'border-amber-500/30 bg-amber-50 text-amber-600' },
  PAID: { label: '已支付', cls: 'border-emerald-500/30 bg-emerald-50 text-emerald-600' },
  CANCELLED: { label: '已取消', cls: 'border-neutral-300 bg-neutral-100 text-neutral-500' },
  REFUNDED: { label: '已退款', cls: 'border-rose-500/30 bg-rose-50 text-rose-600' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
};

// ─── Skeleton Components ─────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} />;
}

function PlanCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonPulse className="h-6 w-20" />
        <SkeletonPulse className="h-5 w-16" />
      </div>
      <SkeletonPulse className="h-4 w-32 mb-3" />
      <SkeletonPulse className="h-4 w-48 mb-6" />
      <div className="flex gap-2">
        <SkeletonPulse className="h-10 w-28" />
        <SkeletonPulse className="h-10 w-28" />
      </div>
    </div>
  );
}

function QuotaGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-neutral-200 bg-white p-5"
        >
          <SkeletonPulse className="h-3 w-20 mb-3" />
          <SkeletonPulse className="h-8 w-24 mb-3" />
          <SkeletonPulse className="h-2 w-full mb-2" />
          <SkeletonPulse className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <SkeletonPulse className="h-4 w-24" />
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-16" />
          <SkeletonPulse className="h-4 w-20" />
          <SkeletonPulse className="h-4 flex-1" />
          <SkeletonPulse className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function BillingPage() {
  // Data states
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [quotas, setQuotas] = useState<Quota[]>([]);

  // Loading states
  const [loadingSub, setLoadingSub] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingQuotas, setLoadingQuotas] = useState(true);

  // UI states
  const [currentPage, setCurrentPage] = useState(1);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetchers ────────────────────────────────────────────────────────────

  const fetchSubscription = useCallback(async () => {
    try {
      setLoadingSub(true);
      const res = await fetch('/api/billing/subscription');
      if (!res.ok) throw new Error('Failed to fetch subscription');
      const data = await res.json();
      setSubscription(data.subscription);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError('加载订阅信息失败');
    } finally {
      setLoadingSub(false);
    }
  }, []);

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoadingOrders(true);
      const res = await fetch(`/api/billing/orders?page=${page}&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data.orders ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchQuotas = useCallback(async () => {
    try {
      setLoadingQuotas(true);
      const res = await fetch('/api/quota');
      if (!res.ok) throw new Error('Failed to fetch quotas');
      const data = await res.json();
      setQuotas(data.data?.quotas ?? []);
    } catch (err) {
      console.error('Error fetching quotas:', err);
    } finally {
      setLoadingQuotas(false);
    }
  }, []);

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSubscription();
    fetchOrders();
    fetchQuotas();
  }, [fetchSubscription, fetchOrders, fetchQuotas]);

  useEffect(() => {
    fetchOrders(currentPage);
  }, [currentPage, fetchOrders]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to cancel subscription');
      setShowCancelModal(false);
      await fetchSubscription();
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setError('取消订阅失败，请重试');
    } finally {
      setCancelling(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!subscription) return;
    try {
      setTogglingAutoRenew(true);
      const res = await fetch('/api/billing/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRenew: !subscription.autoRenew }),
      });
      if (!res.ok) throw new Error('Failed to toggle auto-renew');
      await fetchSubscription();
    } catch (err) {
      console.error('Error toggling auto-renew:', err);
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const currentPlan = subscription?.plan ?? 'FREE';
  const planStyle = PLAN_STYLE[currentPlan];

  const getQuotaColor = (used: number, total: number) => {
    if (total === 0) return { bar: 'bg-neutral-400', text: 'text-neutral-500' };
    const pct = (used / total) * 100;
    if (pct > 80) return { bar: 'bg-rose-500', text: 'text-rose-300' };
    if (pct > 50) return { bar: 'bg-amber-500', text: 'text-amber-300' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-300' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        eyebrow="BILLING"
        title="订阅管理"
        subtitle="管理你的订阅计划、查看额度使用情况和订单记录"
      />

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Current Plan Card */}
      {loadingSub ? (
        <PlanCardSkeleton />
      ) : (
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Plan info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-indigo-500" />
                <h2 className="text-lg font-semibold text-neutral-800">当前订阅</h2>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${planStyle.cls}`}>
                  {planStyle.label}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">价格</div>
                  <div className="text-2xl font-bold text-neutral-800">{planStyle.price}</div>
                </div>
                {subscription?.endDate && (
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">到期时间</div>
                    <div className="flex items-center gap-2 text-sm text-neutral-700">
                      <Calendar className="h-4 w-4 text-neutral-500" />
                      {formatDate(subscription.endDate)}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-neutral-500 mb-1">自动续费</div>
                  <button
                    onClick={handleToggleAutoRenew}
                    disabled={togglingAutoRenew || currentPlan === 'FREE'}
                    className="flex items-center gap-2 text-sm text-neutral-700 disabled:opacity-50"
                  >
                    {togglingAutoRenew ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className={`h-4 w-4 ${subscription?.autoRenew ? 'text-emerald-400' : 'text-neutral-500'}`} />
                    )}
                    <span className={subscription?.autoRenew ? 'text-emerald-300' : 'text-neutral-500'}>
                      {subscription?.autoRenew ? '已开启' : '已关闭'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 sm:flex-col">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
              >
                <ArrowUpRight className="h-4 w-4" />
                升级套餐
              </Link>
              {currentPlan !== 'FREE' && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-500/20"
                >
                  取消订阅
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Quota Overview */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-800">额度概览</h2>
          <span className="text-xs text-neutral-500">本月使用情况</span>
        </div>

        {loadingQuotas ? (
          <QuotaGridSkeleton />
        ) : quotas.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-8 text-center">
            <p className="text-sm text-neutral-500">暂无额度数据</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quotas.map((quota) => {
              const meta = QUOTA_META[quota.type] ?? { label: quota.type, icon: null };
              const colors = getQuotaColor(quota.used, quota.total);
              const pct = quota.total > 0 ? Math.min(100, (quota.used / quota.total) * 100) : 0;

              return (
                <div
                  key={quota.id}
                  className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/40"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="text-indigo-500/80">{meta.icon}</div>
                      <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="text-3xl font-semibold tracking-tight tabular-nums text-neutral-800">
                      {quota.used}
                    </span>
                    <span className="text-sm text-neutral-500"> / {quota.total}</span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className={`h-full rounded-full transition-all ${colors.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={colors.text}>
                      剩余 {quota.remaining}
                    </span>
                    <span className="text-neutral-500">
                      {pct.toFixed(0)}% 已使用
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Order History */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-800">订单记录</h2>
          {pagination && (
            <span className="text-xs text-neutral-500">共 {pagination.total} 条</span>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {loadingOrders ? (
            <div className="p-5">
              <TableSkeleton />
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-neutral-500">暂无订单记录</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                    <tr>
                      <th className="px-5 py-3">订单号</th>
                      <th className="px-5 py-3">套餐</th>
                      <th className="px-5 py-3">金额</th>
                      <th className="px-5 py-3">状态</th>
                      <th className="px-5 py-3">支付方式</th>
                      <th className="px-5 py-3">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/50">
                    {orders.map((order) => {
                      const statusMeta = ORDER_STATUS_META[order.status] ?? {
                        label: order.status,
                        cls: 'border-neutral-300 bg-neutral-100 text-neutral-500',
                      };

                      return (
                        <tr key={order.id} className="hover:bg-neutral-100 transition">
                          <td className="px-5 py-3 font-mono text-xs text-neutral-300">
                            {order.orderNo}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PLAN_STYLE[order.plan]?.cls ?? 'border-neutral-300 bg-neutral-100 text-neutral-500'}`}>
                              {PLAN_STYLE[order.plan]?.label ?? order.plan}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-medium text-neutral-700">
                            ¥{order.amount}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-neutral-500">
                            {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
                          </td>
                          <td className="px-5 py-3 text-neutral-500 text-xs">
                            {formatDateTime(order.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3">
                  <span className="text-xs text-neutral-500">
                    第 {pagination.page} / {pagination.pages} 页
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      上一页
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                      disabled={currentPage >= pagination.pages}
                      className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      下一页
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-neutral-300 bg-neutral-50 p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-800">确认取消订阅</h3>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-neutral-500">
              取消订阅后，你的账户将在当前计费周期结束后降级为免费版。已有的数据会被保留 90 天。
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-neutral-200 disabled:opacity-50"
              >
                再想想
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                {cancelling ? '取消中...' : '确认取消'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
