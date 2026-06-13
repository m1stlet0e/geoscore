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
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 selection:bg-indigo-100 selection:text-indigo-700">
      {/* Background Decorations */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[10%] right-[5%] h-[400px] w-[400px] rounded-full bg-indigo-500/5 blur-[100px]" />
        <div className="absolute bottom-[10%] left-[5%] h-[500px] w-[500px] rounded-full bg-violet-500/5 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <Sidebar plan={plan} userEmail={userEmail} userName={userName} />

      {/* Main content — pushed right by sidebar width on desktop */}
      <div className="relative z-10 md:pl-[280px]">
        <main className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:px-10 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
