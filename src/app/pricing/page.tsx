import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLAN_CONFIG } from '@/lib/billing/billing.service';
import type { Plan } from '@prisma/client';
import { PricingPageClient } from './PricingPageClient';

const PLAN_IDS: Plan[] = ['FREE', 'PRO', 'GROWTH', 'ENTERPRISE'];

export default async function PricingPage() {
  const session = await auth();
  let userPlan: Plan | null = null;

  if (session?.user) {
    const userId = (session.user as { id?: string }).id;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      userPlan = user?.plan ?? null;
    }
  }

  const plans = Object.fromEntries(
    PLAN_IDS.map((id) => [
      id,
      {
        name: PLAN_CONFIG[id].name,
        price: PLAN_CONFIG[id].price,
        quotas: PLAN_CONFIG[id].quotas as Record<string, number>,
        features: PLAN_CONFIG[id].features,
      },
    ])
  ) as Record<
    Plan,
    {
      name: string;
      price: number;
      quotas: Record<string, number>;
      features: string[];
    }
  >;

  return <PricingPageClient plans={plans} userPlan={userPlan} />;
}
