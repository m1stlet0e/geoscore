import NextAuth, { type NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/* ─── 微信 OAuth 自定义 Provider ─── */
function WeChatProvider() {
  return {
    id: 'wechat',
    name: '微信',
    type: 'oauth' as const,
    authorization: {
      url: 'https://open.weixin.qq.com/connect/qrconnect',
      params: {
        appid: process.env.WECHAT_APP_ID,
        scope: 'snsapi_login',
        response_type: 'code',
      },
    },
    token: {
      url: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      async request({ params }: { params: Record<string, string> }) {
        const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}&code=${params.code}&grant_type=authorization_code`;
        const res = await fetch(url);
        const data = await res.json();
        return { tokens: { access_token: data.access_token, openid: data.openid } };
      },
    },
    userinfo: {
      url: 'https://api.weixin.qq.com/sns/userinfo',
      async request({ tokens }: { tokens: Record<string, string> }) {
        const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${tokens.access_token}&openid=${tokens.openid}&lang=zh_CN`;
        const res = await fetch(url);
        return await res.json();
      },
    },
    profile(profile: Record<string, string>) {
      return {
        id: profile.openid,
        name: profile.nickname,
        image: profile.headimgurl,
      };
    },
    clientId: process.env.WECHAT_APP_ID,
    clientSecret: process.env.WECHAT_APP_SECRET,
  };
}

/* ─── 支付宝 OAuth 自定义 Provider ─── */
function AlipayProvider() {
  return {
    id: 'alipay',
    name: '支付宝',
    type: 'oauth' as const,
    authorization: {
      url: 'https://openauth.alipay.com/oauth2/publicAppAuthorize.htm',
      params: {
        app_id: process.env.ALIPAY_APP_ID,
        scope: 'auth_user',
        response_type: 'code',
      },
    },
    token: {
      url: 'https://openapi.alipay.com/gateway.do',
      async request({ params }: { params: Record<string, string> }) {
        const form = new URLSearchParams({
          method: 'alipay.system.oauth.token',
          app_id: process.env.ALIPAY_APP_ID!,
          format: 'JSON',
          charset: 'utf-8',
          sign_type: 'RSA2',
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
          version: '1.0',
          grant_type: 'authorization_code',
          code: params.code,
        });
        const res = await fetch('https://openapi.alipay.com/gateway.do', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        const data = await res.json();
        const tokenData = data.alipay_system_oauth_token_response;
        return { tokens: { access_token: tokenData.access_token, user_id: tokenData.user_id } };
      },
    },
    userinfo: {
      url: 'https://openapi.alipay.com/gateway.do',
      async request({ tokens }: { tokens: Record<string, string> }) {
        const form = new URLSearchParams({
          method: 'alipay.user.info.share',
          app_id: process.env.ALIPAY_APP_ID!,
          format: 'JSON',
          charset: 'utf-8',
          sign_type: 'RSA2',
          timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
          version: '1.0',
          auth_token: tokens.access_token,
        });
        const res = await fetch('https://openapi.alipay.com/gateway.do', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        const data = await res.json();
        return data.alipay_user_info_share_response;
      },
    },
    profile(profile: Record<string, string>) {
      return {
        id: profile.user_id,
        name: profile.nick_name || profile.user_name,
        image: profile.avatar,
      };
    },
    clientId: process.env.ALIPAY_APP_ID,
    clientSecret: process.env.ALIPAY_APP_SECRET,
  };
}

/* ─── 构建 Providers 列表 ─── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: any[] = [
  Credentials({
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      const user = await prisma.user.findUnique({ where: { email: String(credentials.email) } });
      if (!user || !user.passwordHash) return null;
      const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
      if (!valid) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

// 有配置时自动启用微信/支付宝
if (process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) {
  providers.push(WeChatProvider());
}
if (process.env.ALIPAY_APP_ID && process.env.ALIPAY_APP_SECRET) {
  providers.push(AlipayProvider());
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}

export { signIn, signOut } from 'next-auth/react';

const handler = NextAuth(authOptions);
export default handler;
