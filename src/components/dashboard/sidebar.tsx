"use client";

import Link from "next/link";
import { BarChart3, CreditCard, FlaskConical, LogOut, Radar } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function Sidebar() {
  const router = useRouter();
  async function logout() {
    await signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand-mark"><span>G</span>eoScore</Link>
      <nav>
        <Link href="/dashboard"><BarChart3 size={18} />总览</Link>
        <Link href="/dashboard/brands"><Radar size={18} />品牌监测</Link>
        <Link href="/dashboard/experiments"><FlaskConical size={18} />增长实验</Link>
        <Link href="/dashboard/billing"><CreditCard size={18} />套餐与额度</Link>
      </nav>
      <button onClick={logout}><LogOut size={17} />退出登录</button>
    </aside>
  );
}
