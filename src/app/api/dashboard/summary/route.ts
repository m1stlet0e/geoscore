import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    brandCount,
    scanLast30,
    citationLast30,
    unreadAlerts,
    recentScans,
    recentAlerts,
    promptScansAll,
    citationsAll,
  ] = await Promise.all([
    prisma.brand.count({ where: { userId } }),
    prisma.scanRun.count({ where: { userId, startedAt: { gte: thirtyDaysAgo } } }),
    prisma.citation.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.alert.count({ where: { userId, isRead: false } }),
    prisma.scanRun.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      include: { brand: { select: { id: true, name: true } } },
    }),
    prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { brand: { select: { id: true, name: true } } },
    }),
    prisma.promptScan.findMany({
      where: { scanRun: { userId } },
      select: { platform: true, brandMentioned: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    prisma.citation.findMany({
      where: { userId },
      select: { createdAt: true, platform: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
  ]);

  // Trend: last 30 days
  const byDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const c of citationsAll) {
    const k = c.createdAt.toISOString().slice(0, 10);
    if (byDay.has(k)) byDay.set(k, (byDay.get(k) || 0) + 1);
  }
  const citationTrend = Array.from(byDay.entries()).map(([date, count]) => ({ date, count }));

  // Platform distribution
  const platformMap = new Map<string, number>();
  for (const p of promptScansAll) {
    platformMap.set(p.platform, (platformMap.get(p.platform) || 0) + 1);
  }
  const platformDistribution = Array.from(platformMap.entries()).map(([name, value]) => ({ name, value }));

  // Visibility score: % of last 30d promptScans where brandMentioned
  const totalScans = promptScansAll.length;
  const mentionedScans = promptScansAll.filter((p) => p.brandMentioned).length;
  const visibilityScore = totalScans > 0 ? Math.round((mentionedScans / totalScans) * 100) : 0;

  return NextResponse.json({
    stats: {
      brandCount,
      scanLast30,
      citationLast30,
      unreadAlerts,
      visibilityScore,
    },
    citationTrend,
    platformDistribution,
    recentScans,
    recentAlerts,
  });
}
