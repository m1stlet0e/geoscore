'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Logo } from '@/components/Logo';
import type { Plan } from '@prisma/client';

type DashboardChromeProps = {
  plan: Plan;
  userEmail: string | null;
  userName: string | null;
  children: React.ReactNode;
};

export function DashboardChrome({
  plan,
  userEmail,
  userName,
  children,
}: DashboardChromeProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <header
        className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-neutral-100 bg-white/95 px-4 backdrop-blur-md md:hidden"
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 transition hover:bg-neutral-50"
          aria-label="打开导航菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Logo size="sm" />
        <div className="w-10" aria-hidden="true" />
      </header>

      <Sidebar
        plan={plan}
        userEmail={userEmail}
        userName={userName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="relative z-10 pt-14 md:pt-0 md:pl-[280px]">
        <main className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:px-10 sm:py-10">
          {children}
        </main>
      </div>
    </>
  );
}
