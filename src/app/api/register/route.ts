import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Disposable email domains blocklist
const BLOCKED_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'guerrillamail.info', 'dispostable.com', 'trashmail.com', 'mailnesia.com',
  '10minutemail.com', 'temp-mail.org', 'fakeinbox.com', 'tempinbox.com',
  'maildrop.cc', 'mailnator.com', 'getnada.com', 'mohmal.com',
]);

function isValidEmail(email: string): boolean {
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  // Block disposable email domains
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;

  // Block common fake patterns
  if (/^(test|fake|spam|trash|delete)@/i.test(email)) return false;

  return true;
}

export async function POST(req: Request) {
  // IP 级别 rate limiting：每 IP 每分钟最多 3 次注册
  const ip = getClientIp(req);
  const rl = rateLimit(`register:${ip}`, { maxRequests: 3, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '操作过于频繁，请稍后再试' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rl.resetIn / 1000)),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  }

  try {
    const body = await req.json();
    const { name, email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    // Validate email format + disposable check
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: '请使用真实的工作邮箱注册' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: '密码至少需要 8 个字符' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: '该邮箱已注册，请直接登录' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name?.trim() || email.split('@')[0],
        email: email.toLowerCase().trim(),
        passwordHash,
      },
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    );
  }
}
