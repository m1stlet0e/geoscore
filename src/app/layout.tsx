import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/Toaster';
import './globals.css';


export const metadata: Metadata = {
  title: {
    default: '极排 — 国产 AI 引擎可见性管理平台',
    template: '%s · 极排',
  },
  description:
    '极排 — 面向国内 AI 生态的 GEO（生成式引擎优化）平台。监控品牌在文心一言、通义千问、Kimi 等国产 AI 引擎中的可见性与影响力。',
  applicationName: '极排',
  keywords: [
    'GEO', '生成式引擎优化', 'AI 搜索优化',
    '文心一言', '通义千问', 'Kimi', 'AI搜索优化',
  ],
  authors: [{ name: '极排' }],
  openGraph: {
    title: '极排 — 国产 AI 引擎可见性管理平台',
    description: '5 大国产 AI 引擎的品牌可见性与影响力监测平台。',
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
    <html lang="zh-CN">
      <body className="min-h-screen bg-white font-sans text-neutral-800 antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
