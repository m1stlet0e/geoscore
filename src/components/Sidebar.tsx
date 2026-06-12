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
  FREE:       { ring: 'ring-neutral-300',     text: 'text-neutral-600',     bg: 'bg-neutral-100',     label: 'FREE' },
  PRO:        { ring: 'ring-indigo-300',      text: 'text-indigo-600',      bg: 'bg-indigo-50',       label: 'PRO' },
  GROWTH:     { ring: 'ring-violet-300',      text: 'text-violet-600',      bg: 'bg-violet-50',       label: 'GROWTH' },
  ENTERPRISE: { ring: 'ring-amber-300',       text: 'text-amber-600',       bg: 'bg-amber-50',        label: 'ENTERPRISE' },
};

export function Sidebar({ plan = 'FREE', userEmail, userName }: SidebarProps) {
  const pathname = usePathname();
  const planStyle = planStyles[plan];

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-neutral-200 bg-white md:flex"
      aria-label="主导航"
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-neutral-100 px-5">
        <Link href="/dashboard" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
          <Logo size="sm" />
          <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
            AI
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          工作台
        </div>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item, index) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href} style={{ animationDelay: `${index * 30}ms` }}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500 transition-all" />
                  )}
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-indigo-500' : 'text-neutral-400 group-hover:text-neutral-600'
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span
                      className={cn(
                        'hidden text-[10px] text-neutral-400 transition-colors lg:inline',
                        isActive && 'text-indigo-400'
                      )}
                    >
                      {item.hint}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — plan + user + sign out */}
      <div className="border-t border-neutral-100 p-4 space-y-3">
        {/* Plan badge */}
        <div className={cn('rounded-lg border border-neutral-200 bg-neutral-50 p-3', planStyle.ring)}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">当前计划</div>
              <div className={cn('mt-0.5 text-sm font-semibold', planStyle.text)}>{planStyle.label}</div>
            </div>
            {plan === 'FREE' && (
              <Link
                href="/pricing"
                className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 transition-all hover:bg-indigo-100 hover:border-indigo-300"
              >
                升级
              </Link>
            )}
          </div>
        </div>

        {/* User info */}
        {userEmail || userName ? (
          <div className="rounded-lg bg-neutral-50 p-3">
            <div className="truncate text-sm font-medium text-neutral-800">{userName ?? '已登录'}</div>
            <div className="truncate text-xs text-neutral-500 mt-0.5">{userEmail}</div>
          </div>
        ) : null}

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 transition-all hover:bg-neutral-100 hover:text-neutral-700 hover:border-neutral-300"
        >
          <LogOut className="h-3.5 w-3.5" />
          退出登录
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
