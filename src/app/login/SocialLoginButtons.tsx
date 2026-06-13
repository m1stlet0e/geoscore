'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

interface SocialLoginButtonsProps {
  callbackUrl: string;
}

export function SocialLoginButtons({ callbackUrl }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSocialLogin = async (provider: string) => {
    setLoading(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* 微信登录 */}
      <button
        onClick={() => handleSocialLogin('wechat')}
        disabled={loading !== null}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#07C160]/30 bg-[#07C160]/5 px-4 py-2.5 text-sm font-medium text-[#07C160] transition hover:bg-[#07C160]/10 hover:border-[#07C160]/50 disabled:opacity-50"
      >
        {loading === 'wechat' ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#07C160]/30 border-t-[#07C160]" />
        ) : (
          <WeChatIcon />
        )}
        微信登录
      </button>

      {/* 支付宝登录 */}
      <button
        onClick={() => handleSocialLogin('alipay')}
        disabled={loading !== null}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#1677FF]/30 bg-[#1677FF]/5 px-4 py-2.5 text-sm font-medium text-[#1677FF] transition hover:bg-[#1677FF]/10 hover:border-[#1677FF]/50 disabled:opacity-50"
      >
        {loading === 'alipay' ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#1677FF]/30 border-t-[#1677FF]" />
        ) : (
          <AlipayIcon />
        )}
        支付宝登录
      </button>
    </div>
  );
}

/* ─── SVG Icons ─── */

function WeChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.093 6.093 0 0 1-.262-1.794c0-3.66 3.326-6.622 7.43-6.622.334 0 .662.025.986.062C16.682 4.603 13.013 2.188 8.691 2.188zm-2.6 4.408a.958.958 0 1 1 0 1.916.958.958 0 0 1 0-1.916zm5.438 0a.958.958 0 1 1 0 1.916.958.958 0 0 1 0-1.916zM16.5 9.136c-3.706 0-6.71 2.65-6.71 5.918 0 3.268 3.004 5.918 6.71 5.918a8.37 8.37 0 0 0 2.347-.339.727.727 0 0 1 .592.08l1.566.917a.267.267 0 0 0 .137.044c.132 0 .24-.108.24-.242 0-.06-.024-.118-.039-.175l-.32-1.22a.487.487 0 0 1 .175-.548C22.86 18.296 24 16.546 24 14.554 24 11.286 20.205 9.136 16.5 9.136zm-2.636 3.62a.79.79 0 1 1 0 1.58.79.79 0 0 1 0-1.58zm5.273 0a.79.79 0 1 1 0 1.58.79.79 0 0 1 0-1.58z" />
    </svg>
  );
}

function AlipayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.422 14.763c-1.324-.588-2.773-1.227-4.326-1.907.562-1.383.984-2.908 1.242-4.512h-4.08V6.632h5.052V5.352h-5.052V2.316h-2.59v3.036H6.612v1.28h5.048v1.712H7.068v1.28h9.246c-.218 1.186-.556 2.304-.982 3.318-1.758-.777-3.733-1.524-5.87-2.162-2.372 1.242-4.168 3.26-4.894 5.782.92.564 2.06.96 3.326 1.146-.414-.934-.654-2.016-.654-3.168 0-1.884.726-3.594 1.9-4.854 2.114.67 4.204 1.5 5.892 2.406a15.316 15.316 0 0 1 1.134 4.548 10.13 10.13 0 0 1-1.122.042c-1.386 0-2.658-.204-3.768-.576-.57 1.14-1.026 2.364-1.35 3.642h6.852v1.284h-7.65c.348 1.134.822 2.208 1.404 3.18h6.246v1.284H12.75a14.14 14.14 0 0 0 2.328 2.1h4.584v-1.284h-3.48c.852-.678 1.596-1.458 2.214-2.316h1.266v-1.284h-.852c.396-.684.72-1.416.966-2.184 1.266.582 2.442 1.122 3.504 1.608a12.024 12.024 0 0 0 1.146-2.4h-2.826v-1.284h3.672V14.763zM9.756 14.1c1.812.588 3.54 1.278 5.1 2.046a10.19 10.19 0 0 1-.906-3.456c-1.506.648-3.048 1.188-4.194 1.41z" />
    </svg>
  );
}
