"use client";

import Link from "next/link";
import { BarChart3, CreditCard, FileSearch, FlaskConical, HeartPulse, LogOut, Network, Radar, TableProperties } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const intelligenceItems = [
    ["/dashboard", "情报总览", BarChart3],
    ["/dashboard/rankings", "排名矩阵", TableProperties],
    ["/dashboard/reputation", "口碑预警", HeartPulse],
    ["/dashboard/sources", "引用溯源", Network],
    ["/dashboard/evidence", "证据快照", FileSearch],
  ] as const;
  const workItems = [
    ["/dashboard/brands", "品牌监测", Radar],
    ["/dashboard/experiments", "增长实验", FlaskConical],
    ["/dashboard/billing", "套餐与额度", CreditCard],
  ] as const;
  async function logout() {
    await signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand-mark"><span>G</span>eoScore</Link>
      <nav>
        <span className="sidebar-section-label">GEO 情报</span>
        {intelligenceItems.map(([href, label, Icon]) => <Link key={href} href={href} className={pathname === href ? "is-active" : ""}><Icon size={18} />{label}</Link>)}
        <span className="sidebar-section-label">增长执行</span>
        {workItems.map(([href, label, Icon]) => <Link key={href} href={href} className={pathname.startsWith(href) ? "is-active" : ""}><Icon size={18} />{label}</Link>)}
      </nav>
      <button onClick={logout}><LogOut size={17} />退出登录</button>
    </aside>
  );
}
