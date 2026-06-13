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
  ChevronRight,
  User,
  FileText,
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
  { href: '/dashboard', label: '总览看板', icon: Home, hint: 'Overview' },
  { href: '/brands', label: '品牌管理', icon: Globe, hint: 'Brands' },
  { href: '/monitor', label: '监控中心', icon: Radar, hint: 'Monitor' },
  { href: '/citations', label: '引用分析', icon: Quote, hint: 'Citations' },
  { href: '/sources', label: '来源追踪', icon: Network, hint: 'Sources' },
  { href: '/influence', label: '影响力地图', icon: Share2, hint: 'Influence' },
  { href: '/gaps', label: '缺口分析', icon: AlertTriangle, hint: 'Gaps' },
  { href: '/growth', label: '增长中心', icon: Sparkles, hint: 'Growth' },
  { href: '/content', label: '内容中心', icon: FileText, hint: 'Content' },
  { href: '/radar', label: '趋势雷达', icon: TrendingUp, hint: 'Radar' },
  { href: '/forecast', label: '预测模型', icon: LineChart, hint: 'Forecast' },
  { href: '/alerts', label: '实时警报', icon: Bell, hint: 'Alerts' },
  { href: '/settings', label: '系统设置', icon: Settings, hint: 'Settings' },
];

type Plan = 'FREE' | 'PRO' | 'GROWTH' | 'ENTERPRISE';

type SidebarProps = {
  plan?: Plan;
  userEmail?: string | null;
  userName?: string | null;
};

const planStyles: Record<Plan, { text: string; bg: string; label: string }> = {
  FREE:       { text: 'text-neutral-500',     bg: 'bg-neutral-100',     label: '免费版' },
  PRO:        { text: 'text-indigo-600',      bg: 'bg-indigo-50',       label: '专业版' },
  GROWTH:     { text: 'text-violet-600',      bg: 'bg-violet-50',       label: '增长版' },
  ENTERPRISE: { text: 'text-amber-600',       bg: 'bg-amber-50',        label: '企业版' },
};

export function Sidebar({ plan = 'FREE', userEmail, userName }: SidebarProps) {
  const pathname = usePathname();
  const planStyle = planStyles[plan];

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-neutral-100 bg-white md:flex"
      aria-label="主导航"
    >
      {/* Brand */}
      <div className="flex h-20 items-center px-8">
        <Link href="/dashboard" className="group flex items-center gap-3 transition-transform hover:scale-[1.02]">
          <Logo size="md" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 leading-none">Console</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
        <div className="mb-4 px-4 text-[10px] font-black uppercase tracking-[0.3em] text-neutral-400">
          工作台面板
        </div>
        <ul className="space-y-1.5">
          {NAV_ITEMS.map((item, index) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200',
                    isActive
                      ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-indigo-400' : 'text-neutral-400 group-hover:text-neutral-600'
                    )}
                  />
                  <span className="flex-1 font-bold">{item.label}</span>
                  {isActive ? (
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />
                  ) : (
                    item.hint && (
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-0 transition-opacity group-hover:opacity-100">
                        {item.hint}
                      </span>
                    )
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — plan + user + sign out */}
      <div className="p-6 space-y-4">
        {/* User Card */}
        <div className="rounded-3xl border border-neutral-100 bg-neutral-50/50 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm border border-neutral-100">
              <User className="h-5 w-5 text-neutral-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-neutral-900">{userName ?? '已登录用户'}</div>
              <div className={cn('inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest mt-1', planStyle.bg, planStyle.text)}>
                {planStyle.label}
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {plan === 'FREE' && (
              <Link
                href="/pricing"
                className="flex-1 rounded-xl bg-indigo-600 py-2 text-center text-[10px] font-black text-white transition hover:bg-indigo-700"
              >
                升级方案
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex-1 rounded-xl border border-neutral-200 bg-white py-2 text-center text-[10px] font-black text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e5e7eb;
        }
      `}</style>
    </aside>
  );
}

export default Sidebar;
