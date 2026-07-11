"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function splitValues(value: string) {
  return value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean);
}

export function CreateBrandForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true); setError("");
    const response = await fetch("/api/brands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"), website: formData.get("website"), industry: formData.get("industry"),
        product: formData.get("product"), targetAudience: formData.get("targetAudience"),
        aliases: splitValues(String(formData.get("aliases") ?? "")), competitors: splitValues(String(formData.get("competitors") ?? "")),
      }),
    });
    const result = await response.json(); setPending(false);
    if (!response.ok) { setError(result.message ?? "创建失败"); return; }
    router.push(`/dashboard/brands/${result.brand.id}`); router.refresh();
  }

  return <form action={submit} className="brand-form">
    <div className="form-grid"><label>品牌名称<input name="name" placeholder="例如：GeoScore" required /></label><label>品牌官网<input name="website" placeholder="geoscore.cn" required /></label></div>
    <div className="form-grid"><label>所属行业<input name="industry" placeholder="例如：软件与互联网" required /></label><label>核心产品<input name="product" placeholder="例如：AI 品牌可见度监测平台" required /></label></div>
    <label>目标客户<input name="targetAudience" placeholder="例如：品牌市场负责人和创业者" required /></label>
    <label>品牌别名<textarea name="aliases" placeholder="多个别名用逗号分隔，例如：Geo Score，极欧评分" /></label>
    <label>主要竞品<textarea name="competitors" placeholder="多个竞品用逗号分隔，也可以稍后修改" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={pending}>{pending ? "正在创建…" : "创建品牌并生成问题"}</button>
  </form>;
}
