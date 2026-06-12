import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/Toaster';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-dm-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'GeoScore — Rank In AI, Not Just Google',
    template: '%s · GeoScore',
  },
  description:
    'GeoScore 是面向 AI 时代的 GEO（生成式引擎优化）操作系统。监控品牌在 ChatGPT、Perplexity、Gemini 等 7 大 AI 引擎中的可见性、引用、来源与影响力，并自动生成可发布的内容。',
  applicationName: 'GeoScore',
  keywords: [
    'GEO', 'Generative Engine Optimization', 'AI 搜索', 'AI SEO',
    'ChatGPT 品牌监控', 'Perplexity', 'AEO', 'AI visibility',
  ],
  authors: [{ name: 'GeoScore' }],
  openGraph: {
    title: 'GeoScore — Rank In AI, Not Just Google',
    description: '7 大 AI 引擎的品牌可见性、引用、来源、影响力和内容自动化平台。',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={dmSans.variable}>
      <body className="min-h-screen bg-white font-sans text-neutral-800 antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
