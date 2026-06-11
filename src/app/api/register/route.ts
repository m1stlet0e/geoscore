import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 位'),
  name: z.string().min(1).max(60).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? '参数错误', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  try {
    const existing = await prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: emailLower,
        name: name?.trim() || emailLower.split('@')[0],
        passwordHash,
        plan: 'FREE',
      },
      select: { id: true, email: true, name: true, plan: true },
    });

    // Auto-create a default brand for the new user so the dashboard isn't empty
    const defaultBrandName = (name?.trim() || emailLower.split('@')[0]) + ' 的主品牌';
    try {
      await prisma.brand.create({
        data: {
          userId: user.id,
          name: defaultBrandName,
          status: 'active',
        },
      });
    } catch {
      // Ignore brand creation failure (e.g. duplicate name); user creation still succeeds
    }

    return NextResponse.json(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器内部错误';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
