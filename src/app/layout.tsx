import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoScore - AI 品牌可见度评分平台",
  description: "检测品牌在主流 AI 回答中的提及、推荐、引用和竞品表现。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
