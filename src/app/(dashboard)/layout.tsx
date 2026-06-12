import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/Sidebar';
import type { Plan } from '@prisma/client';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?redirect=/dashboard');
  }

  const plan: Plan = (session.user as { plan?: Plan }).plan ?? 'FREE';
  const userEmail = session.user.email ?? null;
  const userName = session.user.name ?? null;

  return (
    <div className="min-h-screen bg-white text-neutral-800">
      {/* Subtle grid — only on large screens */}
      <div className="pointer-events-none fixed inset-0 hidden bg-grid opacity-30 lg:block" aria-hidden="true" />

      <Sidebar plan={plan} userEmail={userEmail} userName={userName} />

      {/* Main content — pushed right by sidebar width on desktop */}
      <div className="relative md:pl-[240px]">
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
