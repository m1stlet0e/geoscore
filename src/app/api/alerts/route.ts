import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const isRead = searchParams.get('isRead');
  const where: Record<string, unknown> = { userId };
  if (type) where.type = type;
  if (isRead === 'true') where.isRead = true;
  if (isRead === 'false') where.isRead = false;
  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { brand: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const body = (await req.json()) as { brandId?: string; type?: string; severity?: string; title?: string; message?: string };
  if (!body.brandId || !body.type || !body.title || !body.message) {
    return NextResponse.json({ error: '缺少字段' }, { status: 400 });
  }
  // verify ownership
  const brand = await prisma.brand.findFirst({ where: { id: body.brandId, userId } });
  if (!brand) return NextResponse.json({ error: '品牌不存在' }, { status: 404 });
  const a = await prisma.alert.create({
    data: {
      brandId: brand.id,
      userId,
      type: body.type,
      severity: body.severity || 'medium',
      title: body.title,
      message: body.message,
    },
  });
  return NextResponse.json({ alert: a }, { status: 201 });
}
