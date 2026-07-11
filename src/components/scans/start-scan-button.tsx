"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";

export function StartScanButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setPending(true); setError("");
    const created = await fetch("/api/scans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brandId, platforms: ["mock"] }) });
    const createResult = await created.json();
    if (!created.ok) { setPending(false); setError(createResult.message ?? "扫描创建失败"); return; }
    const executed = await fetch(`/api/scans/${createResult.scan.id}/execute`, { method: "POST" });
    const executeResult = await executed.json(); setPending(false);
    if (!executed.ok) { setError(executeResult.message ?? "扫描执行失败"); return; }
    router.push(`/dashboard/scans/${createResult.scan.id}`); router.refresh();
  }
  return <div className="scan-action"><button className="primary-button" onClick={start} disabled={pending}><ScanSearch size={18} />{pending ? "正在扫描 10 个问题…" : "开始免费扫描"}</button>{error && <p className="form-error">{error}</p>}</div>;
}
