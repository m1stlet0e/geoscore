'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  AlertTriangle,
  Bell,
  Globe,
  Home,
  LineChart,
  LogOut,
  Network,
  Quote,
  Radar,
  Settings,
  Share2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, hint: '总览' },
  { href: '/brands', label: '品牌管理', icon: Globe, hint: '添加品牌' },
  { href: '/monitor', label: '监控中心', icon: Radar, hint: '7 引擎可见性' },
  { href: '/citations', label: '引用分析', icon: Quote, hint: 'AI 答案引用' },
  { href: '/sources', label: '来源追踪', icon: Network, hint: '域名权重' },
  { href: '/influence', label: '影响力地图', icon: Share2, hint: '知识图谱' },
  { href: '/gaps', label: '缺口分析', icon: AlertTriangle, hint: '竞品 vs 你' },
  { href: '/growth', label: 'Growth Agent', icon: Sparkles, hint: 'AI 内容生成' },
  { href: '/radar', label: 'Prompt Radar', icon: TrendingUp, hint: '趋势信号' },
  { href: '/forecast', label: '预测', icon: LineChart, hint: '30/90 天' },
  { href: '/alerts', label: '警报', icon: Bell, hint: '实时通知' },
  { href: '/settings', label: '设置', icon: Settings, hint: '账户 / 团队' },
];

type Plan = 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE';

type SidebarProps = {
  plan?: Plan;
  userEmail?: string | null;
  userName?: string | null;
};

const planStyles: Record<Plan, { ring: string; text: string; bg: string; label: string }> = {
  FREE:       { ring: 'ring-neutral-300',     text: 'text-neutral-300',     bg: 'bg-slate-900/40',     label: 'FREE' },
  PRO:        { ring: 'ring-indigo-500/40',    text: 'text-indigo-200',    bg: 'bg-indigo-400/10',    label: 'PRO' },
  GROWTH:     { ring: 'ring-violet-500/40',    text: 'text-violet-200',    bg: 'bg-violet-500/10',    label: 'GROWTH' },
  ENTERPRISE: { ring: 'ring-amber-400/40',     text: 'text-amber-200',     bg: 'bg-amber-500/10',     label: 'ENTERPRISE' },
};

export function Sidebar({ plan = 'FREE', userEmail, userName }: SidebarProps) {
  const pathname = usePathname();
  const planStyle = planStyles[plan];

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-neutral-800 bg-neutral-950 md:flex"
      aria-label="主导航"
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-neutral-800 px-4">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <Logo size="sm" />
          <span className="inline-flex items-center rounded-md border border-indigo-500/30 bg-indigo-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
            AI
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          工作台
        </div>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                    isActive
                      ? 'bg-indigo-400/15 text-slate-50'
                      : 'text-slate-500 hover:bg-slate-900/60 hover:text-slate-100'
                  )}
                >
                  {isActive ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-400" />
                  ) : null}
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition',
                      isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-neutral-100'
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint ? (
                    <span
                      className={cn(
                        'hidden text-[10px] text-slate-500 lg:inline',
                        isActive && 'text-indigo-300/80'
                      )}
                    >
                      {item.hint}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — plan + user + sign out */}
      <div className="border-t border-neutral-800 p-3">
        <div className={cn('mb-3 flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-2.5 py-2', planStyle.ring)}>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">当前计划</div>
            <div className={cn('mt-0.5 text-sm font-semibold', planStyle.text)}>{planStyle.label}</div>
          </div>
          {plan === 'FREE' ? (
            <Link
              href="/pricing"
              className="rounded-md border border-indigo-500/30 bg-indigo-400/10 px-2 py-1 text-[11px] font-medium text-indigo-200 transition hover:bg-indigo-400/20"
            >
              升级
            </Link>
          ) : null}
        </div>

        {userEmail || userName ? (
          <div className="mb-2 truncate rounded-lg bg-slate-900/40 px-2.5 py-2 text-xs">
            <div className="truncate font-medium text-neutral-200">{userName ?? '已登录'}</div>
            <div className="truncate text-slate-500">{userEmail}</div>
          </div>
        ) : null}

        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-800/60 hover:bg-slate-900/60 hover:text-slate-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          退出登录
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
