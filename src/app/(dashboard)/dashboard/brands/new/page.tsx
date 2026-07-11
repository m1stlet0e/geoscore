import Link from "next/link";
import { CreateBrandForm } from "@/components/brands/create-brand-form";

export default function NewBrandPage() {
  return <main className="dashboard-page narrow-page"><Link href="/dashboard/brands" className="back-link">← 返回品牌列表</Link><header><div><p className="eyebrow">品牌初始化</p><h1>告诉我们，你想被谁看见</h1><p>系统会据此生成首批非品牌问题，你可以在扫描前确认和调整。</p></div></header><CreateBrandForm /></main>;
}
