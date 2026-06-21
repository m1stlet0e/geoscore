import NextAuth, { type NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { prisma } from '@/lib/prisma';

/* ─── 密钥 ─── */
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
  throw new Error(
    'AUTH_SECRET or NEXTAUTH_SECRET must be set and at least 32 characters long'
  );
}
const _secret = new TextEncoder().encode(AUTH_SECRET);

/* ─── Cookie 名：开发/生产环境 ─── */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

/* ─── 服务端会话类型 ─── */
export type AuthUser = { id?: string; email?: string | null; name?: string | null; plan?: string };
export type AuthSession = { user: AuthUser } | null;

/* ─── JWT 编解码（登录 API 和 auth() 共用）─── */

/** 编码 JWT —— 登录 API 调用 */
export async function encodeSessionToken(payload: Record<string, unknown>) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 30 * 24 * 60 * 60)
    .setJti(crypto.randomUUID())
    .sign(_secret);
}

/** 解码 JWT —— auth() 和 NextAuth decode 回调共用 */
export async function decodeSessionToken(token: string): Promise<JWTPayload | null> {
  if (!token || typeof token !== 'string') return null;
  try {
    const { payload } = await jwtVerify(token, _secret, { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}

/* ─── 核心：auth() — 直接从 cookie 读 JWT 验证，不依赖 getServerSession ─── */

export async function auth(): Promise<AuthSession> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await decodeSessionToken(token);
    if (!payload) return null;
    const user: AuthUser = {
      id: (payload.id ?? payload.sub) as string | undefined,
      email: payload.email as string | null | undefined,
      name: payload.name as string | null | undefined,
      plan: (payload.plan ?? 'FREE') as string,
    };
    return { user };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth] session decode error:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}

/* ─── 微信 OAuth ─── */
function WeChatProvider() {
  return {
    id: 'wechat', name: '微信', type: 'oauth' as const,
    authorization: {
      url: 'https://open.weixin.qq.com/connect/qrconnect',
      params: { appid: process.env.WECHAT_APP_ID, scope: 'snsapi_login', response_type: 'code' },
    },
    token: {
      url: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      async request({ params }: { params: Record<string, string> }) {
        const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&code=${params.code}&grant_type=authorization_code`;
        const res = await fetch(url); const data = await res.json();
        return { tokens: { access_token: data.access_token, openid: data.openid } };
      },
    },
    userinfo: {
      url: 'https://api.weixin.qq.com/sns/userinfo',
      async request({ tokens }: { tokens: Record<string, string> }) {
        const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${tokens.access_token}&openid=${tokens.openid}&lang=zh_CN`;
        const res = await fetch(url); return await res.json();
      },
    },
    profile(profile: Record<string, string>) {
      return { id: profile.openid, name: profile.nickname, image: profile.headimgurl };
    },
    clientId: process.env.WECHAT_APP_ID, clientSecret: process.env.WECHAT_APP_SECRET,
  };
}

/* ─── 支付宝 OAuth ─── */
function AlipayProvider() {
  return {
    id: 'alipay', name: '支付宝', type: 'oauth' as const,
    authorization: {
      url: 'https://openauth.alipay.com/oauth2/publicAppAuthorize.htm',
      params: { app_id: process.env.ALIPAY_APP_ID, scope: 'auth_user', response_type: 'code' },
    },
    token: {
      url: 'https://openapi.alipay.com/gateway.do',
      async request({ params }: { params: Record<string, string> }) {
        const form = new URLSearchParams({
          method: 'alipay.system.oauth.token', app_id: process.env.ALIPAY_APP_ID!,
          format: 'JSON', charset: 'utf-8', sign_type: 'RSA2',
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
          version: '1.0', grant_type: 'authorization_code', code: params.code,
        });
        const res = await fetch('https://openapi.alipay.com/gateway.do', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(),
        });
        const data = await res.json();
        return { tokens: { access_token: data.alipay_system_oauth_token_response.access_token, user_id: data.alipay_system_oauth_token_response.user_id } };
      },
    },
    userinfo: {
      url: 'https://openapi.alipay.com/gateway.do',
      async request({ tokens }: { tokens: Record<string, string> }) {
        const form = new URLSearchParams({
          method: 'alipay.user.info.share', app_id: process.env.ALIPAY_APP_ID!,
          format: 'JSON', charset: 'utf-8', sign_type: 'RSA2',
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
          version: '1.0', auth_token: tokens.access_token,
        });
        const res = await fetch('https://openapi.alipay.com/gateway.do', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(),
        });
        const data = await res.json();
        return data.alipay_user_info_share_response;
      },
    },
    profile(profile: Record<string, string>) {
      return { id: profile.user_id, name: profile.nick_name || profile.user_name, image: profile.avatar };
    },
    clientId: process.env.ALIPAY_APP_ID, clientSecret: process.env.ALIPAY_APP_SECRET,
  };
}

/* ─── Providers ─── */
const providers: any[] = [
  Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      const email = String(credentials.email).toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) return null;
      const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
      if (!valid) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image, plan: user.plan };
    },
  }),
];

if (process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) providers.push(WeChatProvider());
if (process.env.ALIPAY_APP_ID && process.env.ALIPAY_APP_SECRET) providers.push(AlipayProvider());

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers,
  jwt: {
    async encode({ token }) {
      if (!token) return '';
      return encodeSessionToken(token as Record<string, unknown>);
    },
    async decode({ token }): Promise<any> {
      if (!token) return null;
      const payload = await decodeSessionToken(token);
      // 合法 token → 返回 payload；解码失败 → 返回 _stale 标记
      // 这样 NextAuth 不会回退到 JWE 解密从而产生 Invalid Compact JWE 错误
      return payload ?? { _stale: true as const };
    },
  },
  callbacks: {
    async jwt({ token, user }): Promise<any> {
      if (user) {
        token.id = (user as { id: string }).id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.plan = (user as { plan?: string }).plan ?? 'FREE';
        delete (token as Record<string, unknown>)._stale;
      }
      if ((token as Record<string, unknown>)._stale) {
        return {} as any;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string; plan?: string }).id = token.id as string;
        (session.user as { id?: string; plan?: string }).plan = (token.plan as string) ?? 'FREE';
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export default handler;
