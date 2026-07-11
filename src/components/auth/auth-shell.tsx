import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
  alternate,
}: {
  title: string;
  description: string;
  children: ReactNode;
  alternate: { text: string; label: string; href: string };
}) {
  return (
    <main className="auth-page">
      <Link href="/" className="brand-mark"><span>G</span>eoScore</Link>
      <section className="auth-card">
        <p className="eyebrow">AI 品牌可见度平台</p>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
        <p className="auth-alternate">{alternate.text} <Link href={alternate.href}>{alternate.label}</Link></p>
      </section>
    </main>
  );
}
