"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { clientErrorMessage, readApiResponse } from "@/lib/client-api";

export function ResumeScanButton({
  scanId,
  status,
}: {
  scanId: string;
  status: "PENDING" | "RUNNING";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function resume() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/scans/${scanId}/execute`, { method: "POST" });
      await readApiResponse(response, "扫描恢复失败，请检查网络后重试");
      router.push(`/dashboard/scans/${scanId}`);
      router.refresh();
    } catch (cause) {
      setError(clientErrorMessage(cause, "扫描恢复失败，请检查网络后重试"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="resume-scan-action">
      <span className="scan-state-label">
        {status === "PENDING" ? "等待执行" : "执行中断，可安全恢复"}
      </span>
      {error && <p className="form-error" role="status" aria-live="polite">{error}</p>}
      <button
        type="button"
        className="primary-button"
        disabled={pending}
        onClick={() => void resume()}
      >
        <RotateCcw aria-hidden="true" size={16} />
        {pending ? "正在恢复扫描…" : error ? "重试继续扫描" : "继续未完成扫描"}
      </button>
    </div>
  );
}
