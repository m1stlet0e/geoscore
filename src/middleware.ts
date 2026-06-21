import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/pricing', '/about', '/login', '/register', '/forgot-password'];
const PUBLIC_API = [
  '/api/auth',
  '/api/register',
  '/api/cron',
  '/api/health',
  '/api/public',
];

const PUBLIC_MARKETING_PREFIXES = [
  '/tools/',
  '/blog/',
  '/cases/',
  '/changelog',
  '/docs/',
];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiAuth = PUBLIC_API.some((p) => pathname.startsWith(p));
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isMarketingPublic = PUBLIC_MARKETING_PREFIXES.some((p) => pathname.startsWith(p));
  const isStatic = pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/public') || /\.[a-zA-Z0-9]+$/.test(pathname);

  if (pathname.startsWith('/api/')) {
    if (isApiAuth) return NextResponse.next();
    return NextResponse.next();
  }

  if (isStatic || isPublic || isAuthPage || isMarketingPublic) return NextResponse.next();

  // Check JWT auth cookie (NextAuth or custom session)
  const sessionToken = req.cookies.get('next-auth.session-token')?.value
    || req.cookies.get('__Secure-next-auth.session-token')?.value;

  if (!sessionToken) {
    const url = new URL('/login', req.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
