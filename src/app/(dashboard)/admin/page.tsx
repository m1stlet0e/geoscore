'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Activity,
  Globe,
  Quote,
  DollarSign,
  UserPlus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
  Shield,
  Crown,
  X,
  Loader2,
  FileText,
  Settings,
  BarChart3,
  CreditCard,
  ClipboardList,
  Save,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { normalizePagination } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Plan = 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE';
type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
type Tab = 'users' | 'orders' | 'quota' | 'logs' | 'config';

interface PlanDistribution {
  plan: Plan;
  count: number;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalBrands: number;
  totalCitations: number;
  totalScans: number;
  totalRevenue: number;
  planDistribution: PlanDistribution[];
  recentSignups: number;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  plan: Plan;
  brandsCount: number;
  citationsCount: number;
  createdAt: string;
  subscription?: {
    plan: Plan;
    status: string;
    startDate: string;
    endDate: string | null;
  } | null;
  brands?: Array<{ id: string; name: string; domain: string }>;
}

interface Order {
  id: string;
  orderNo: string;
  userEmail: string;
  plan: Plan;
  amount: number;
  status: OrderStatus;
  paymentMethod: string;
  createdAt: string;
}

interface QuotaItem {
  userId: string;
  userEmail: string;
  plan: Plan;
  quotaType: string;
  used: number;
  total: number;
  remaining: number;
}

interface LogEntry {
  id: string;
  adminEmail: string;
  action: string;
  target: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ConfigItem {
  key: string;
  value: string;
  description: string;
  editing?: boolean;
  editValue?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<Plan, string> = {
  FREE: 'bg-neutral-300 text-neutral-500',
  PRO: 'bg-blue-600/30 text-blue-300',
  GROWTH: 'bg-purple-600/30 text-purple-300',
  ENTERPRISE: 'bg-amber-600/30 text-amber-300',
};

const ROLE_COLORS: Record<Role, string> = {
  USER: 'bg-neutral-300 text-neutral-500',
  ADMIN: 'bg-indigo-600/30 text-indigo-500',
  SUPER_ADMIN: 'bg-rose-600/30 text-rose-300',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-600/30 text-amber-300',
  PAID: 'bg-emerald-600/30 text-emerald-300',
  FAILED: 'bg-rose-600/30 text-rose-300',
  REFUNDED: 'bg-neutral-400/30 text-neutral-500',
  CANCELLED: 'bg-neutral-300 text-neutral-500',
};

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'users', label: '用户管理', icon: <Users className="h-4 w-4" /> },
  { key: 'orders', label: '订单管理', icon: <CreditCard className="h-4 w-4" /> },
  { key: 'quota', label: '额度监控', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'logs', label: '操作日志', icon: <ClipboardList className="h-4 w-4" /> },
  { key: 'config', label: '系统配置', icon: <Settings className="h-4 w-4" /> },
];

const PLAN_OPTIONS: Plan[] = ['FREE', 'PRO', 'GROWTH', 'ENTERPRISE'];
const ORDER_STATUS_OPTIONS: OrderStatus[] = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'];
const ACTION_OPTIONS = ['USER_UPDATE', 'PLAN_CHANGE', 'ROLE_CHANGE', 'ORDER_CREATE', 'CONFIG_UPDATE', 'LOGIN'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatCurrency(amount: number) {
  return `¥${(amount / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

// ─── Skeleton Components ─────────────────────────────────────────────────────

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} />;
}

function StatCardsSkeleton() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-5">
          <SkeletonPulse className="h-3 w-20 mb-3" />
          <SkeletonPulse className="h-8 w-24 mb-3" />
          <SkeletonPulse className="h-3 w-32" />
        </div>
      ))}
    </section>
  );
}

function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 pb-2 border-b border-neutral-300">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonPulse key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonPulse key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
      <div className="mb-4 text-neutral-500">{icon}</div>
      <p className="text-sm font-medium text-neutral-500">{title}</p>
      <p className="mt-1 text-xs text-neutral-500">{description}</p>
    </div>
  );
}

// ─── Pagination Component ────────────────────────────────────────────────────

function PaginationBar({ pagination, onPageChange }: { pagination: Pagination; onPageChange: (page: number) => void }) {
  const { page, totalPages, total } = pagination;
  return (
    <div className="flex items-center justify-between border-t border-neutral-300 pt-4">
      <span className="text-xs text-neutral-500">共 {total} 条记录</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-neutral-300 p-1.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs text-neutral-500">
          第 {page} / {totalPages} 页
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-neutral-300 p-1.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── User Detail Modal ───────────────────────────────────────────────────────

function UserDetailModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  if (!user) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-neutral-300 bg-neutral-50 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-500 transition">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-lg font-semibold text-neutral-800">用户详情</h3>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-500">邮箱</span>
              <p className="mt-1 text-neutral-700">{user.email}</p>
            </div>
            <div>
              <span className="text-neutral-500">姓名</span>
              <p className="mt-1 text-neutral-700">{user.name || '-'}</p>
            </div>
            <div>
              <span className="text-neutral-500">角色</span>
              <div className="mt-1">
                <Badge label={user.role} className={ROLE_COLORS[user.role]} />
              </div>
            </div>
            <div>
              <span className="text-neutral-500">套餐</span>
              <div className="mt-1">
                <Badge label={user.plan} className={PLAN_COLORS[user.plan]} />
              </div>
            </div>
            <div>
              <span className="text-neutral-500">品牌数</span>
              <p className="mt-1 text-neutral-700">{user.brandsCount}</p>
            </div>
            <div>
              <span className="text-neutral-500">引用数</span>
              <p className="mt-1 text-neutral-700">{user.citationsCount}</p>
            </div>
            <div className="col-span-2">
              <span className="text-neutral-500">注册时间</span>
              <p className="mt-1 text-neutral-700">{formatDate(user.createdAt)}</p>
            </div>
          </div>
          {user.subscription && (
            <div className="rounded-xl border border-neutral-300 p-4">
              <h4 className="text-sm font-medium text-neutral-500 mb-2">订阅信息</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-neutral-500">计划</span>
                  <p className="text-neutral-700">{user.subscription.plan}</p>
                </div>
                <div>
                  <span className="text-neutral-500">状态</span>
                  <p className="text-neutral-700">{user.subscription.status}</p>
                </div>
                <div>
                  <span className="text-neutral-500">开始日期</span>
                  <p className="text-neutral-700">{formatDate(user.subscription.startDate)}</p>
                </div>
                <div>
                  <span className="text-neutral-500">结束日期</span>
                  <p className="text-neutral-700">{user.subscription.endDate ? formatDate(user.subscription.endDate) : '无期限'}</p>
                </div>
              </div>
            </div>
          )}
          {user.brands && user.brands.length > 0 && (
            <div className="rounded-xl border border-neutral-300 p-4">
              <h4 className="text-sm font-medium text-neutral-500 mb-2">品牌列表</h4>
              <div className="space-y-2">
                {user.brands.map((brand) => (
                  <div key={brand.id} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-700">{brand.name}</span>
                    <span className="text-neutral-500">{brand.domain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminPage() {
  // Auth & role
  const [currentRole, setCurrentRole] = useState<Role>('USER');

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Tab
  const [activeTab, setActiveTab] = useState<Tab>('users');

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [usersPagination, setUsersPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState<Plan | ''>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingPlanUserId, setEditingPlanUserId] = useState<string | null>(null);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersPagination, setOrdersPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | ''>('');

  // Quota
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [quotasLoading, setQuotasLoading] = useState(true);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsPagination, setLogsPagination] = useState<Pagination>({ page: 1, limit: 100, total: 0, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(true);
  const [logActionFilter, setLogActionFilter] = useState('');

  // Config
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState<string | null>(null);

  // ─── Fetch Functions ──────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        const planDistribution = Array.isArray(data.planDistribution)
          ? data.planDistribution
          : Object.entries(data.planDistribution ?? {}).map(([plan, count]) => ({
              plan,
              count: Number(count),
            }));
        setStats({
          totalUsers: data.totalUsers ?? 0,
          activeUsers: data.activeUsers ?? 0,
          totalBrands: data.totalBrands ?? 0,
          totalCitations: data.totalCitations ?? 0,
          totalScans: data.totalScans ?? 0,
          totalRevenue: data.totalRevenue ?? 0,
          planDistribution,
          recentSignups: data.recentSignups ?? 0,
        });
      }
    } catch (e) {
      console.error('Failed to fetch admin stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async (page = 1, search = '', plan = '') => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      if (plan) params.set('plan', plan);
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
        setUsersPagination(normalizePagination(data.pagination) ?? { page: 1, limit: 50, total: 0, totalPages: 0 });
        // Assume first user in admin response gives us our role context
        // In real app this would come from session
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async (page = 1, status = '') => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status) params.set('status', status);
      const res = await fetch(`/api/admin/orders?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders ?? []);
        setOrdersPagination(normalizePagination(data.pagination) ?? { page: 1, limit: 50, total: 0, totalPages: 0 });
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchQuotas = useCallback(async () => {
    setQuotasLoading(true);
    try {
      const res = await fetch('/api/admin/quota');
      if (res.ok) {
        const data = await res.json();
        setQuotas(
          (Array.isArray(data) ? data : []).map((q: {
            userId?: string;
            user?: { id?: string; email?: string; plan?: Plan };
            type?: string;
            quotaType?: string;
            used?: number;
            total?: number;
            remaining?: number;
          }) => ({
            userId: q.userId ?? q.user?.id ?? '',
            userEmail: q.user?.email ?? '-',
            plan: (q.user?.plan ?? 'FREE') as Plan,
            quotaType: q.quotaType ?? q.type ?? '-',
            used: q.used ?? 0,
            total: q.total ?? 0,
            remaining: q.remaining ?? Math.max(0, (q.total ?? 0) - (q.used ?? 0)),
          }))
        );
      }
    } catch (e) {
      console.error('Failed to fetch quotas:', e);
    } finally {
      setQuotasLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async (page = 1, action = '') => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '100' });
      if (action) params.set('action', action);
      const res = await fetch(`/api/admin/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setLogsPagination(normalizePagination(data.pagination) ?? { page: 1, limit: 100, total: 0, totalPages: 0 });
      }
    } catch (e) {
      console.error('Failed to fetch logs:', e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchConfigs = useCallback(async () => {
    setConfigsLoading(true);
    try {
      const res = await fetch('/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setConfigs(list.map((c: ConfigItem) => ({ ...c, editing: false, editValue: c.value })));
      }
    } catch (e) {
      console.error('Failed to fetch configs:', e);
    } finally {
      setConfigsLoading(false);
    }
  }, []);

  const updateUserPlan = useCallback(async (userId: string, newPlan: Plan) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u)));
        setEditingPlanUserId(null);
      }
    } catch (e) {
      console.error('Failed to update user plan:', e);
    }
  }, []);

  const saveConfig = useCallback(async (key: string, value: string) => {
    setConfigSaving(key);
    try {
      const res = await fetch(`/api/admin/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        setConfigs((prev) =>
          prev.map((c) => (c.key === key ? { ...c, value, editing: false, editValue: value } : c))
        );
      }
    } catch (e) {
      console.error('Failed to save config:', e);
    } finally {
      setConfigSaving(null);
    }
  }, []);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
    // Fetch current user role
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.role) setCurrentRole(data.user.role);
      })
      .catch(() => {});
  }, [fetchStats]);

  useEffect(() => {
    switch (activeTab) {
      case 'users':
        fetchUsers(1, userSearch, userPlanFilter);
        break;
      case 'orders':
        fetchOrders(1, orderStatusFilter);
        break;
      case 'quota':
        fetchQuotas();
        break;
      case 'logs':
        fetchLogs(1, logActionFilter);
        break;
      case 'config':
        fetchConfigs();
        break;
    }
  }, [activeTab, fetchUsers, fetchOrders, fetchQuotas, fetchLogs, fetchConfigs, userSearch, userPlanFilter, orderStatusFilter, logActionFilter]);

  // ─── Filtered Tabs ────────────────────────────────────────────────────────

  const visibleTabs = TABS.filter((t) => (t.key === 'config' ? currentRole === 'SUPER_ADMIN' : true));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <PageHeader title="Admin Dashboard" subtitle="系统管理中心" />

      {/* Stats Cards */}
      {statsLoading ? (
        <StatCardsSkeleton />
      ) : stats ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="总用户数"
            value={stats.totalUsers.toLocaleString()}
            icon={<Users className="h-5 w-5" />}
            subline="全部注册用户"
          />
          <StatCard
            label="活跃用户"
            value={stats.activeUsers.toLocaleString()}
            icon={<Activity className="h-5 w-5" />}
            tone="positive"
            subline="近30天活跃"
          />
          <StatCard
            label="总品牌数"
            value={stats.totalBrands.toLocaleString()}
            icon={<Globe className="h-5 w-5" />}
            subline="已创建品牌"
          />
          <StatCard
            label="总引用数"
            value={stats.totalCitations.toLocaleString()}
            icon={<Quote className="h-5 w-5" />}
            subline="AI引用总次数"
          />
          <StatCard
            label="总收入"
            value={formatCurrency(stats.totalRevenue)}
            icon={<DollarSign className="h-5 w-5" />}
            tone="positive"
            subline="累计订单收入"
          />
          <StatCard
            label="近期注册"
            value={stats.recentSignups.toLocaleString()}
            icon={<UserPlus className="h-5 w-5" />}
            subline="近7天新注册"
          />
        </section>
      ) : null}

      {/* Plan Distribution */}
      {stats && (stats.planDistribution?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 className="text-sm font-medium text-neutral-500 mb-4">套餐分布</h3>
          <div className="flex gap-3">
            {stats.planDistribution.map((item) => {
              const maxCount = Math.max(...stats.planDistribution.map((d) => d.count), 1);
              const pct = (item.count / maxCount) * 100;
              const barColors: Record<Plan, string> = {
                FREE: 'bg-neutral-500',
                PRO: 'bg-blue-500',
                GROWTH: 'bg-purple-500',
                ENTERPRISE: 'bg-amber-500',
              };
              return (
                <div key={item.plan} className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <Badge label={item.plan} className={PLAN_COLORS[item.plan]} />
                    <span className="text-neutral-500 font-medium">{item.count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColors[item.plan]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200">
        <nav className="flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition border-b-2 ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-500'
                  : 'border-transparent text-neutral-500 hover:text-neutral-500 hover:border-neutral-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        {/* ─── 用户管理 ────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="搜索邮箱或姓名..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-200/50 py-2 pl-10 pr-4 text-sm text-neutral-700 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <select
                  value={userPlanFilter}
                  onChange={(e) => setUserPlanFilter(e.target.value as Plan | '')}
                  className="rounded-xl border border-neutral-300 bg-neutral-200/50 py-2 pl-10 pr-8 text-sm text-neutral-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition appearance-none cursor-pointer"
                >
                  <option value="">全部套餐</option>
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <TableSkeleton rows={8} cols={8} />
            ) : users.length === 0 ? (
              <EmptyState icon={<Users className="h-12 w-12" />} title="暂无用户" description="没有找到符合条件的用户" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="pb-3 text-left font-medium text-neutral-500">邮箱</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">姓名</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">角色</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">套餐</th>
                      <th className="pb-3 text-right font-medium text-neutral-500">品牌</th>
                      <th className="pb-3 text-right font-medium text-neutral-500">引用</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">注册时间</th>
                      <th className="pb-3 text-right font-medium text-neutral-500">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/50">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-neutral-200/30 transition">
                        <td className="py-3 text-neutral-700 max-w-[200px] truncate">{user.email}</td>
                        <td className="py-3 text-neutral-500">{user.name || '-'}</td>
                        <td className="py-3">
                          <Badge label={user.role} className={ROLE_COLORS[user.role]} />
                        </td>
                        <td className="py-3">
                          <Badge label={user.plan} className={PLAN_COLORS[user.plan]} />
                        </td>
                        <td className="py-3 text-right text-neutral-500">{user.brandsCount}</td>
                        <td className="py-3 text-right text-neutral-500">{user.citationsCount}</td>
                        <td className="py-3 text-neutral-500 text-xs">{formatDate(user.createdAt)}</td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedUser(user)}
                              className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-300 hover:text-neutral-700 transition"
                            >
                              查看详情
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setEditingPlanUserId(editingPlanUserId === user.id ? null : user.id)}
                                className="rounded-lg border border-indigo-600/40 bg-indigo-600/10 px-2.5 py-1 text-xs text-indigo-500 hover:bg-indigo-600/20 transition"
                              >
                                修改套餐
                              </button>
                              {editingPlanUserId === user.id && (
                                <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-xl border border-neutral-300 bg-neutral-50 shadow-xl py-1">
                                  {PLAN_OPTIONS.map((p) => (
                                    <button
                                      key={p}
                                      onClick={() => updateUserPlan(user.id, p)}
                                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-neutral-200 transition ${
                                        user.plan === p ? 'text-indigo-500 bg-indigo-600/10' : 'text-neutral-500'
                                      }`}
                                    >
                                      {p}
                                      {user.plan === p && ' ✓'}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar
                  pagination={usersPagination}
                  onPageChange={(page) => fetchUsers(page, userSearch, userPlanFilter)}
                />
              </div>
            )}
          </div>
        )}

        {/* ─── 订单管理 ────────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as OrderStatus | '')}
                  className="rounded-xl border border-neutral-300 bg-neutral-200/50 py-2 pl-10 pr-8 text-sm text-neutral-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition appearance-none cursor-pointer"
                >
                  <option value="">全部状态</option>
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {ordersLoading ? (
              <TableSkeleton rows={8} cols={7} />
            ) : orders.length === 0 ? (
              <EmptyState icon={<CreditCard className="h-12 w-12" />} title="暂无订单" description="没有找到符合条件的订单" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="pb-3 text-left font-medium text-neutral-500">订单号</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">用户邮箱</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">套餐</th>
                      <th className="pb-3 text-right font-medium text-neutral-500">金额</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">状态</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">支付方式</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">日期</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/50">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-neutral-200/30 transition">
                        <td className="py-3 text-neutral-500 font-mono text-xs">{order.orderNo}</td>
                        <td className="py-3 text-neutral-700 max-w-[180px] truncate">{order.userEmail}</td>
                        <td className="py-3">
                          <Badge label={order.plan} className={PLAN_COLORS[order.plan]} />
                        </td>
                        <td className="py-3 text-right text-neutral-700 font-medium">{formatCurrency(order.amount)}</td>
                        <td className="py-3">
                          <Badge label={order.status} className={STATUS_COLORS[order.status]} />
                        </td>
                        <td className="py-3 text-neutral-500 text-xs">{order.paymentMethod}</td>
                        <td className="py-3 text-neutral-500 text-xs">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar
                  pagination={ordersPagination}
                  onPageChange={(page) => fetchOrders(page, orderStatusFilter)}
                />
              </div>
            )}
          </div>
        )}

        {/* ─── 额度监控 ────────────────────────────────────────────────── */}
        {activeTab === 'quota' && (
          <div className="space-y-4">
            {quotasLoading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : quotas.length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-12 w-12" />} title="暂无额度数据" description="没有额度使用信息" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="pb-3 text-left font-medium text-neutral-500">用户邮箱</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">套餐</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">额度类型</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">使用情况</th>
                      <th className="pb-3 text-right font-medium text-neutral-500">剩余</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/50">
                    {quotas
                      .sort((a, b) => {
                        const aPct = a.total > 0 ? a.used / a.total : 0;
                        const bPct = b.total > 0 ? b.used / b.total : 0;
                        return bPct - aPct;
                      })
                      .map((q, i) => {
                        const pct = q.total > 0 ? (q.used / q.total) * 100 : 0;
                        const barColor = pct > 80 ? 'bg-rose-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
                        const textColor = pct > 80 ? 'text-rose-300' : pct > 50 ? 'text-amber-300' : 'text-emerald-300';
                        return (
                          <tr key={`${q.userId}-${q.quotaType}-${i}`} className="hover:bg-neutral-200/30 transition">
                            <td className="py-3 text-neutral-700 max-w-[180px] truncate">{q.userEmail}</td>
                            <td className="py-3">
                              <Badge label={q.plan} className={PLAN_COLORS[q.plan]} />
                            </td>
                            <td className="py-3 text-neutral-500">{q.quotaType}</td>
                            <td className="py-3 min-w-[200px]">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-neutral-200 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium whitespace-nowrap ${textColor}`}>
                                  {q.used}/{q.total}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className={`text-sm font-medium ${textColor}`}>{q.remaining}</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── 操作日志 ────────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="rounded-xl border border-neutral-300 bg-neutral-200/50 py-2 pl-10 pr-8 text-sm text-neutral-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition appearance-none cursor-pointer"
                >
                  <option value="">全部操作</option>
                  {ACTION_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            {logsLoading ? (
              <TableSkeleton rows={8} cols={5} />
            ) : logs.length === 0 ? (
              <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="暂无日志" description="没有操作日志记录" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="pb-3 text-left font-medium text-neutral-500">管理员</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">操作</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">目标</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">详情</th>
                      <th className="pb-3 text-left font-medium text-neutral-500">时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/50">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-200/30 transition">
                        <td className="py-3 text-neutral-700 max-w-[160px] truncate">{log.adminEmail}</td>
                        <td className="py-3">
                          <Badge label={log.action} className="bg-indigo-600/20 text-indigo-500" />
                        </td>
                        <td className="py-3 text-neutral-500 text-xs max-w-[160px] truncate">{log.target}</td>
                        <td className="py-3 text-neutral-500 text-xs max-w-[240px] truncate font-mono">
                          {log.meta ? JSON.stringify(log.meta).slice(0, 80) : '-'}
                        </td>
                        <td className="py-3 text-neutral-500 text-xs whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationBar
                  pagination={logsPagination}
                  onPageChange={(page) => fetchLogs(page, logActionFilter)}
                />
              </div>
            )}
          </div>
        )}

        {/* ─── 系统配置 ────────────────────────────────────────────────── */}
        {activeTab === 'config' && currentRole === 'SUPER_ADMIN' && (
          <div className="space-y-4">
            {configsLoading ? (
              <TableSkeleton rows={5} cols={4} />
            ) : configs.length === 0 ? (
              <EmptyState icon={<Settings className="h-12 w-12" />} title="暂无配置" description="系统配置项为空" />
            ) : (
              <div className="space-y-3">
                {configs.map((config) => (
                  <div
                    key={config.key}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-neutral-300 p-4 hover:border-neutral-300 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-indigo-500 bg-indigo-600/10 px-2 py-0.5 rounded">{config.key}</code>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{config.description}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:min-w-[300px]">
                      <input
                        type="text"
                        value={config.editing ? config.editValue ?? '' : config.value}
                        onFocus={() => {
                          setConfigs((prev) =>
                            prev.map((c) => (c.key === config.key ? { ...c, editing: true, editValue: c.value } : c))
                          );
                        }}
                        onChange={(e) => {
                          setConfigs((prev) =>
                            prev.map((c) => (c.key === config.key ? { ...c, editValue: e.target.value } : c))
                          );
                        }}
                        className="flex-1 rounded-lg border border-neutral-300 bg-neutral-200/50 py-1.5 px-3 text-sm text-neutral-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition"
                      />
                      <button
                        onClick={() => saveConfig(config.key, config.editValue ?? config.value)}
                        disabled={configSaving === config.key}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                      >
                        {configSaving === config.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        保存
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}
