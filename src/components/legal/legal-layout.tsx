import Link from "next/link";
import type { ReactNode } from "react";

export function LegalLayout({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  return <main className="legal-page"><nav><Link href="/" className="brand-mark"><span>G</span>eoScore</Link><Link href="/">返回首页</Link></nav><article><p className="eyebrow">GeoScore 法律文件</p><h1>{title}</h1><p className="legal-date">更新日期：{updatedAt}</p>{children}</article></main>;
}
