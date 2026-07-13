"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, RefreshCw, ScanSearch } from "lucide-react";
import { ClientApiError, clientErrorMessage, readApiResponse } from "@/lib/client-api";

type DataMode = "REAL" | "SIMULATED";

type ProviderDescriptor = {
  id: string;
  name: string;
  dataMode: DataMode;
  available: boolean;
  unavailableReason?: string;
};

type StartScanButtonProps = {
  brandId: string;
  activePromptCount: number;
  quotaBalance: number;
};

const modeLabels: Record<DataMode, string> = {
  REAL: "真实 AI 数据",
  SIMULATED: "模拟演示数据",
};

export function StartScanButton({
  brandId,
  activePromptCount,
  quotaBalance,
}: StartScanButtonProps) {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [repeatCount, setRepeatCount] = useState(1);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState("");
  const [pendingPhase, setPendingPhase] = useState<"" | "creating" | "executing">("");
  const [createdScanId, setCreatedScanId] = useState("");
  const [creationKey, setCreationKey] = useState("");
  const [creationLocked, setCreationLocked] = useState(false);
  const [error, setError] = useState("");

  const loadProviders = useCallback(async () => {
    setLoadingProviders(true);
    setProviderError("");
    try {
      const response = await fetch("/api/ai/providers");
      const result = await readApiResponse<{ providers?: unknown }>(
        response,
        "AI 数据源加载失败，请重试",
      );
      if (!Array.isArray(result.providers)) {
        throw new ClientApiError("AI 数据源加载失败，请重试");
      }
      const nextProviders = result.providers as ProviderDescriptor[];
      setProviders(nextProviders);
      setSelectedProviderIds((current) => current.filter((id) => (
        nextProviders.some((provider) => provider.id === id && provider.available)
      )));
    } catch (cause) {
      setProviderError(clientErrorMessage(cause, "AI 数据源加载失败，请重试"));
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProviders();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProviders]);

  const selectedProviders = useMemo(() => providers.filter((provider) => (
    selectedProviderIds.includes(provider.id)
  )), [providers, selectedProviderIds]);
  const selectedMode = selectedProviders[0]?.dataMode;
  const estimatedCost = activePromptCount * selectedProviderIds.length * repeatCount;
  const quotaInsufficient = estimatedCost > quotaBalance;

  function toggleProvider(provider: ProviderDescriptor, checked: boolean) {
    if (!provider.available) return;
    setError("");
    setSelectedProviderIds((current) => {
      if (!checked) return current.filter((id) => id !== provider.id);
      const sameModeIds = current.filter((id) => (
        providers.find((item) => item.id === id)?.dataMode === provider.dataMode
      ));
      return [...sameModeIds, provider.id].filter((id, index, all) => all.indexOf(id) === index);
    });
  }

  async function start() {
    if (!selectedProviderIds.length || quotaInsufficient) return;
    setError("");
    try {
      let scanId = createdScanId;
      if (!scanId) {
        setPendingPhase("creating");
        const currentCreationKey = creationKey || globalThis.crypto.randomUUID();
        if (!creationKey) setCreationKey(currentCreationKey);
        setCreationLocked(true);
        try {
          const created = await fetch("/api/scans", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "Idempotency-Key": currentCreationKey,
            },
            body: JSON.stringify({
              brandId,
              platforms: selectedProviderIds,
              repeatCount,
            }),
          });
          const createResult = await readApiResponse<{ scan?: { id?: string } }>(
            created,
            "扫描创建失败，请重试",
          );
          const scan = createResult.scan as { id?: string } | undefined;
          if (!scan?.id) {
            throw new ClientApiError("扫描创建结果不完整", created.status, true);
          }
          scanId = scan.id;
          setCreatedScanId(scanId);
        } catch (cause) {
          if (cause instanceof ClientApiError && !cause.uncertain) {
            setCreationKey("");
            setCreationLocked(false);
          }
          throw cause;
        }
      }

      setPendingPhase("executing");
      const executed = await fetch(`/api/scans/${scanId}/execute`, { method: "POST" });
      try {
        await readApiResponse(executed, "扫描执行失败，请重试");
      } catch (cause) {
        const message = clientErrorMessage(cause, "扫描执行失败，请重试");
        if (message === "扫描已失败，请重新创建") {
          setCreatedScanId("");
          setCreationKey("");
          setCreationLocked(false);
        }
        throw cause;
      }
      router.push(`/dashboard/scans/${scanId}`);
      router.refresh();
    } catch (cause) {
      setError(clientErrorMessage(cause, "扫描未完成，请检查网络后重试"));
    } finally {
      setPendingPhase("");
    }
  }

  const actionLabel = pendingPhase === "creating"
    ? "正在创建扫描…"
    : pendingPhase === "executing"
      ? "正在执行扫描…"
      : error
        ? "重试扫描"
        : "开始扫描";

  return (
    <section className="scan-config" aria-label="新建 AI 扫描">
      <div className="scan-config-heading">
        <span className="section-index">SCAN / 01</span>
        <div>
          <h2>配置新一轮监测</h2>
          <p>按当前启用问题计算，扫描结果会保存为可追溯报告。</p>
        </div>
      </div>

      {loadingProviders ? (
        <p className="scan-loading" role="status">正在读取 AI 数据源…</p>
      ) : providerError ? (
        <div className="scan-load-error" role="status">
          <AlertTriangle aria-hidden="true" size={18} />
          <span>{providerError}</span>
          <button type="button" className="text-button" onClick={() => void loadProviders()}>
            <RefreshCw aria-hidden="true" size={15} />重新加载数据源
          </button>
        </div>
      ) : (
        <fieldset className="provider-fieldset">
          <legend>选择 AI 数据源</legend>
          <div className="provider-options">
            {providers.map((provider) => {
              const reasonId = `provider-${provider.id}-reason`;
              return (
                <label
                  className={`provider-option${provider.available ? "" : " is-unavailable"}`}
                  key={provider.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedProviderIds.includes(provider.id)}
                    disabled={!provider.available || creationLocked}
                    aria-describedby={!provider.available ? reasonId : undefined}
                    onChange={(event) => toggleProvider(provider, event.currentTarget.checked)}
                  />
                  <span className="provider-check" aria-hidden="true" />
                  <span className="provider-copy">
                    <strong>{provider.name}</strong>
                    <span>{modeLabels[provider.dataMode]}</span>
                    {!provider.available && (
                      <small id={reasonId}>不可用：{provider.unavailableReason ?? "未满足启用条件"}</small>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <fieldset className="repeat-fieldset">
        <legend>重复采样次数</legend>
        <div className="repeat-options">
          {[1, 2, 3].map((count) => (
            <label key={count}>
              <input
                type="radio"
                name={`repeat-${brandId}`}
                value={count}
                checked={repeatCount === count}
                disabled={creationLocked}
                onChange={() => setRepeatCount(count)}
              />
              <span>{count} 次</span>
            </label>
          ))}
        </div>
        <p>重复采样可降低单次回答波动，成本按问题 × 数据源 × 次数计算。</p>
      </fieldset>

      <div className="scan-cost-bar">
        <Database aria-hidden="true" size={18} />
        <div>
          <strong>预计消耗 {estimatedCost} 次</strong>
          <span>{activePromptCount} 个启用问题 · 当前额度 {quotaBalance} 次</span>
        </div>
        {selectedMode && <b className={`mode-stamp mode-${selectedMode.toLowerCase()}`}>{modeLabels[selectedMode]}</b>}
      </div>

      {selectedMode === "SIMULATED" && (
        <p className="simulation-disclaimer" role="note">
          仅用于体验闭环，不代表真实 AI 表现
        </p>
      )}
      {quotaInsufficient && (
        <p className="form-error">当前额度不足，请降低配置或补充额度。</p>
      )}
      {activePromptCount === 0 && (
        <p className="form-error">请先启用至少一个监测问题。</p>
      )}
      {error && <p className="form-error" role="status" aria-live="polite">{error}</p>}

      <button
        type="button"
        className="primary-button scan-start-button"
        onClick={() => void start()}
        disabled={
          loadingProviders
          || Boolean(providerError)
          || !selectedProviderIds.length
          || activePromptCount === 0
          || quotaInsufficient
          || Boolean(pendingPhase)
        }
      >
        <ScanSearch aria-hidden="true" size={18} />
        {actionLabel}
      </button>
    </section>
  );
}
