"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, FlaskConical, LoaderCircle, Save } from "lucide-react";
import { ClientApiError, clientErrorMessage, readApiResponse } from "@/lib/client-api";

type ExperimentStatus = "DRAFT" | "ACTIVE" | "VERIFYING" | "VERIFIED" | "INCONCLUSIVE";

export type ExperimentPanelData = {
  id: string;
  updatedAt: string;
  title: string;
  hypothesis: string;
  actionPlan: string;
  targetUrl: string | null;
  status: ExperimentStatus;
  nextCheckAt: string | null;
  verificationLeaseExpiresAt: string | null;
  resultSummary: string | null;
  scoreDelta: number | null;
  mentionDelta: number | null;
  recommendationDelta: number | null;
  citationDelta: number | null;
  baselineScanId: string;
  followUpScanId: string | null;
  baselineDataMode: "REAL" | "SIMULATED";
};

const modeLabels = {
  REAL: "真实 AI 数据",
  SIMULATED: "模拟演示数据",
} as const;

const statusLabels: Record<ExperimentStatus, string> = {
  DRAFT: "行动草案",
  ACTIVE: "行动执行中",
  VERIFYING: "正在验证",
  VERIFIED: "已验证提升",
  INCONCLUSIVE: "结果待观察",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDelta(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

export function ExperimentPanel({
  experiment: initialExperiment,
  referenceTimeMs,
}: {
  experiment: ExperimentPanelData;
  referenceTimeMs: number;
}) {
  const router = useRouter();
  const [experiment, setExperiment] = useState(initialExperiment);
  const [actionPlan, setActionPlan] = useState(initialExperiment.actionPlan);
  const [targetUrl, setTargetUrl] = useState(initialExperiment.targetUrl ?? "");
  const [pending, setPending] = useState<"" | "save" | "verify">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [quotaRequired, setQuotaRequired] = useState(false);

  const terminal = experiment.status === "VERIFIED" || experiment.status === "INCONCLUSIVE";
  const dueInFuture = experiment.status === "ACTIVE"
    && experiment.baselineDataMode === "REAL"
    && Boolean(experiment.nextCheckAt)
    && new Date(experiment.nextCheckAt as string).getTime() > referenceTimeMs;
  const verificationLeaseIsActive = experiment.status === "VERIFYING"
    && Boolean(experiment.verificationLeaseExpiresAt)
    && new Date(experiment.verificationLeaseExpiresAt as string).getTime() > referenceTimeMs;

  async function saveAction() {
    setPending("save");
    setError("");
    setNotice("");
    setQuotaRequired(false);
    try {
      const response = await fetch(`/api/experiments/${experiment.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionPlan, targetUrl }),
      });
      const result = await readApiResponse<{ experiment?: Partial<ExperimentPanelData> }>(
        response,
        "行动版本保存失败，请重试",
      );
      if (!result.experiment) throw new ClientApiError("实验更新结果不完整");
      setExperiment((current) => ({ ...current, ...result.experiment }));
      setNotice(experiment.status === "DRAFT" ? "行动实验已发布" : "行动版本已保存");
      router.refresh();
    } catch (cause) {
      setError(clientErrorMessage(cause, "行动版本保存失败，请重试"));
    } finally {
      setPending("");
    }
  }

  async function verify() {
    setPending("verify");
    setError("");
    setNotice("");
    setQuotaRequired(false);
    try {
      const response = await fetch(`/api/experiments/${experiment.id}/verify`, {
        method: "POST",
      });
      const result = await readApiResponse<{ experiment?: Partial<ExperimentPanelData> }>(
        response,
        "实验验证失败，请重试",
      );
      if (!result.experiment) throw new ClientApiError("实验验证结果不完整");
      setExperiment((current) => ({ ...current, ...result.experiment }));
      router.refresh();
    } catch (cause) {
      if (cause instanceof ClientApiError && cause.status === 402) setQuotaRequired(true);
      setError(clientErrorMessage(cause, "实验验证失败，请重试"));
    } finally {
      setPending("");
    }
  }

  return (
    <section className="experiment-panel">
      <header className="experiment-panel-heading">
        <div>
          <span className="section-index">EXPERIMENT / {experiment.id.slice(-6).toUpperCase()}</span>
          <h2>{experiment.title}</h2>
          <p>{experiment.hypothesis}</p>
        </div>
        <div className="experiment-stamps">
          <b className={`status-stamp status-${experiment.status.toLowerCase()}`}>{statusLabels[experiment.status]}</b>
          <b className={`mode-stamp mode-${experiment.baselineDataMode.toLowerCase()}`}>
            {modeLabels[experiment.baselineDataMode]}
          </b>
        </div>
      </header>

      {experiment.baselineDataMode === "SIMULATED" && (
        <p className="simulation-disclaimer">仅用于体验闭环，不代表真实 AI 表现</p>
      )}

      {terminal ? (
        <div className="experiment-result">
          <div className="experiment-result-summary">
            <CheckCircle2 aria-hidden="true" size={24} />
            <div>
              <strong>{statusLabels[experiment.status]}</strong>
              <p>{experiment.resultSummary ?? "本轮实验尚未形成明确结论。"}</p>
            </div>
          </div>
          <div className="experiment-deltas">
            {[
              ["GeoScore 变化", experiment.scoreDelta],
              ["提及率变化", experiment.mentionDelta],
              ["推荐率变化", experiment.recommendationDelta],
              ["引用率变化", experiment.citationDelta],
            ].map(([label, value]) => (
              <article key={String(label)}>
                <span>{label}</span>
                <strong>{formatDelta(value as number | null)}</strong>
              </article>
            ))}
          </div>
          <div className="experiment-report-links">
            <Link href={`/dashboard/scans/${experiment.baselineScanId}`}>
              查看基线报告<ArrowUpRight aria-hidden="true" size={15} />
            </Link>
            {experiment.followUpScanId && (
              <Link href={`/dashboard/scans/${experiment.followUpScanId}`}>
                查看复扫报告<ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            )}
          </div>
        </div>
      ) : experiment.status === "VERIFYING" ? (
        <div className="experiment-verifying-shell">
          <div className="experiment-verifying" role="status" aria-live="polite">
            <LoaderCircle aria-hidden="true" size={28} />
            <div>
              <strong>{verificationLeaseIsActive
                ? "正在复扫并计算实验结果"
                : "验证执行已中断，可以安全恢复"}</strong>
              <p>{verificationLeaseIsActive
                ? "系统会复用基线问题、数据源和采样次数，请勿重复触发。"
                : "恢复会沿用同一实验和固定基线配置，不会另建实验。"}</p>
            </div>
          </div>
          {error && <p className="form-error" role="status" aria-live="polite">{error}</p>}
          {quotaRequired && (
            <Link className="billing-recovery-link" href="/dashboard/billing">查看套餐与额度</Link>
          )}
          {verificationLeaseIsActive ? (
            <button type="button" className="secondary-button" onClick={() => router.refresh()}>
              <LoaderCircle aria-hidden="true" size={16} />刷新验证状态
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={pending === "verify"}
              onClick={() => void verify()}
            >
              <FlaskConical aria-hidden="true" size={16} />
              {pending === "verify" ? "正在恢复验证…" : "恢复验证"}
            </button>
          )}
        </div>
      ) : (
        <div className="experiment-editor">
          <label>
            <span>行动计划</span>
            <textarea
              value={actionPlan}
              minLength={10}
              rows={6}
              onChange={(event) => setActionPlan(event.currentTarget.value)}
            />
          </label>
          <label>
            <span>目标网址</span>
            <input
              type="url"
              value={targetUrl}
              placeholder="https://example.com/content"
              onChange={(event) => setTargetUrl(event.currentTarget.value)}
            />
          </label>

          {dueInFuture && experiment.nextCheckAt && (
            <p className="experiment-due-note">
              真实数据需要等待内容被 AI 重新发现；最早复查时间：{formatDate(experiment.nextCheckAt)}
            </p>
          )}
          {notice && <p className="success-message" role="status" aria-live="polite">{notice}</p>}
          {error && <p className="form-error" role="status" aria-live="polite">{error}</p>}
          {quotaRequired && (
            <Link className="billing-recovery-link" href="/dashboard/billing">查看套餐与额度</Link>
          )}

          <div className="experiment-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={pending !== "" || actionPlan.trim().length < 10}
              onClick={() => void saveAction()}
            >
              <Save aria-hidden="true" size={16} />
              {pending === "save"
                ? "正在保存…"
                : experiment.status === "DRAFT"
                  ? "发布行动实验"
                  : "保存行动版本"}
            </button>
            {experiment.status === "ACTIVE" && (
              <button
                type="button"
                className="primary-button"
                disabled={pending !== "" || dueInFuture}
                onClick={() => void verify()}
              >
                <FlaskConical aria-hidden="true" size={16} />
                {pending === "verify"
                  ? "正在验证…"
                  : dueInFuture
                    ? "尚未到复查时间"
                    : "开始验证"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
