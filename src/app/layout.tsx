import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoScore - AI 推荐增长行动平台",
  description: "定位 AI 没有推荐品牌的原因，生成问题级增长实验，并由用户手动发起同配置复测。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
