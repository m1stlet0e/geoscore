import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;
  const alert = await prisma.alert.findFirst({ where: { id, userId } });
  if (!alert) return NextResponse.json({ error: '警报不存在' }, { status: 404 });
  const updated = await prisma.alert.update({ where: { id }, data: { isRead: true } });
  return NextResponse.json({ alert: updated });
}
