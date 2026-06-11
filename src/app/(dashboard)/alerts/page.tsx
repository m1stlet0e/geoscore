import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bell, CheckCircle2, AlertTriangle, Sparkles, Target, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { prisma } from '@/lib/prisma';
import { cn, formatDate } from '@/lib/utils';
import { MarkAllReadButton, MarkReadButton } from './_buttons';

export const dynamic = 'force-dynamic';

const SEVERITY: Record<string, { ring: string; dot: string; text: string; label: string; icon: React.ReactNode }> = {
  high: { ring: 'border-l-rose-500/60', dot: 'bg-rose-400', text: 'text-rose-200', label: '高', icon: <AlertTriangle className="h-4 w-4" /> },
  medium: { ring: 'border-l-amber-500/60', dot: 'bg-amber-400', text: 'text-amber-200', label: '中', icon: <Bell className="h-4 w-4" /> },
  low: { ring: 'border-l-slate-500/60', dot: 'bg-slate-400', text: 'text-slate-200', label: '低', icon: <Sparkles className="h-4 w-4" /> },
};

const TYPE_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
  visibility_drop: { label: '可见性下降', icon: <TrendingUp className="h-3.5 w-3.5 rotate-180" /> },
  new_competitor: { label: '新竞品', icon: <Target className="h-3.5 w-3.5" /> },
  gap_opened: { label: '缺口打开', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  trend_rising: { label: '趋势上升', icon: <TrendingUp className="h-3.5 w-3.5" /> },
};

const TABS = [
  { id: 'all', label: '全部' },
  { id: 'unread', label: '未读' },
  { id: 'visibility_drop', label: '可见性下降' },
  { id: 'new_competitor', label: '新竞品' },
  { id: 'gap_opened', label: '缺口' },
  { id: 'trend_rising', label: '趋势' },
];

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id: string }).id;
  const { tab = 'all' } = await searchParams;

  const where: Record<string, unknown> = { userId };
  if (tab === 'unread') where.isRead = false;
  else if (tab !== 'all') where.type = tab;

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { brand: { select: { id: true, name: true } } },
  });
  const unreadCount = await prisma.alert.count({ where: { userId, isRead: false } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="智能预警中心"
        subtitle="AI 引用变化、竞品动作、流量机会一网打尽"
        actions={<MarkAllReadButton hasUnread={unreadCount > 0} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Link
              key={t.id}
              href={`/alerts?tab=${t.id}`}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition',
                active
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200'
                  : 'border-slate-800/60 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              )}
            >
              {t.label}
              {t.id === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500/20 px-1 text-xs text-rose-200">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-12 text-center">
          <Bell className="mx-auto h-8 w-8 text-slate-500" />
          <h3 className="mt-4 text-lg font-medium">没有警报</h3>
          <p className="mt-2 text-sm text-slate-400">所有指标都在正常范围</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => {
            const sev = SEVERITY[a.severity] || SEVERITY.low;
            const type = TYPE_LABEL[a.type] || { label: a.type, icon: <Sparkles className="h-3.5 w-3.5" /> };
            return (
              <div
                key={a.id}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border border-slate-800/60 border-l-4 bg-slate-900/40 p-4 transition',
                  sev.ring,
                  !a.isRead && 'ring-1 ring-indigo-500/20'
                )}
              >
                <div className={cn('mt-0.5', sev.text)}>{sev.icon}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-md px-2 py-0.5 text-xs', sev.text, 'bg-slate-800/40')}>
                      {sev.label} 优先级
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/40 px-2 py-0.5 text-xs text-slate-300">
                      {type.icon} {type.label}
                    </span>
                    {a.brand && (
                      <span className="rounded-md bg-slate-800/40 px-2 py-0.5 text-xs text-slate-400">
                        {a.brand.name}
                      </span>
                    )}
                    {!a.isRead && <span className="h-2 w-2 rounded-full bg-indigo-400" />}
                  </div>
                  <h3 className="text-sm font-medium text-slate-100">{a.title}</h3>
                  <p className="text-sm text-slate-400">{a.message}</p>
                  <div className="text-xs text-slate-500">{formatDate(a.createdAt)}</div>
                </div>
                {!a.isRead && <MarkReadButton id={a.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
