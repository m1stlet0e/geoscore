"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import { ClientApiError, clientErrorMessage, readApiResponse } from "@/lib/client-api";
import { formatAiProviderLabel } from "@/lib/growth-data";

export type OpportunityCardData = {
  id: string;
  type: "MENTION_GAP" | "COMPETITOR_ADVANTAGE" | "CITATION_GAP" | "BRAND_RISK";
  priority: number;
  platformId: string;
  title: string;
  summary: string;
  evidence: string;
  recommendedAction: string;
  targetContentType: string;
  promptText: string;
  experimentId: string | null;
};

const opportunityLabels = {
  MENTION_GAP: "提及缺口",
  COMPETITOR_ADVANTAGE: "竞品领先",
  CITATION_GAP: "引用缺口",
  BRAND_RISK: "品牌风险",
} as const;

export function OpportunityCard({ opportunity }: { opportunity: OpportunityCardData }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function createExperiment() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}/experiment`, {
        method: "POST",
      });
      const result = await readApiResponse<{
        message?: string;
        experiment?: { id?: string };
      }>(response, "实验创建失败，请重试");
      if (!result.experiment?.id) throw new ClientApiError("实验创建结果不完整");
      router.push(`/dashboard/experiments/${result.experiment.id}`);
      router.refresh();
    } catch (cause) {
      setError(clientErrorMessage(cause, "实验创建失败，请重试"));
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="opportunity-card">
      <div className="opportunity-card-topline">
        <span>{opportunityLabels[opportunity.type]}</span>
        <strong>优先级 {opportunity.priority}</strong>
      </div>
      <h3>{opportunity.title}</h3>
      <p className="opportunity-summary">{opportunity.summary}</p>
      <dl className="opportunity-context">
        <div>
          <dt>用户问题</dt>
          <dd>{opportunity.promptText}</dd>
        </div>
        <div>
          <dt>数据源</dt>
          <dd>{formatAiProviderLabel(opportunity.platformId)}</dd>
        </div>
        <div>
          <dt>目标内容</dt>
          <dd>{opportunity.targetContentType}</dd>
        </div>
      </dl>
      <div className="opportunity-evidence">
        <span>证据</span>
        <p>{opportunity.evidence}</p>
      </div>
      <div className="opportunity-action">
        <span>建议行动</span>
        <p>{opportunity.recommendedAction}</p>
      </div>

      {pending && <p className="inline-status" role="status" aria-live="polite">正在创建实验…</p>}
      {error && <p className="form-error" role="status" aria-live="polite">{error}</p>}
      {opportunity.experimentId ? (
        <Link className="secondary-button opportunity-button" href={`/dashboard/experiments/${opportunity.experimentId}`}>
          查看增长实验<ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      ) : (
        <button
          type="button"
          className="primary-button opportunity-button"
          disabled={pending}
          onClick={() => void createExperiment()}
        >
          <FlaskConical aria-hidden="true" size={16} />
          {error ? "重试创建实验" : "创建增长实验"}
        </button>
      )}
    </article>
  );
}
