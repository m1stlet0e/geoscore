'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Play, X, Trash2, Check, ChevronRight } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { AI_PLATFORMS, getPlatformMeta } from '@/lib/constants';

// =====================================================
// PromptRow — single prompt line with toggle + delete
// =====================================================
type PromptLite = {
  id: string;
  text: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
};

export function PromptRow({
  prompt,
  categoryLabel,
}: {
  prompt: PromptLite;
  categoryLabel: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState(prompt.isActive);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !active }),
      });
      if (res.ok) {
        setActive(!active);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('确认删除这个 Prompt?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="transition hover:bg-neutral-100">
      <td className="px-2 py-3">
        <p className="line-clamp-2 max-w-xl text-sm text-neutral-700">{prompt.text}</p>
      </td>
      <td className="px-2 py-3">
        <span className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
          {categoryLabel}
        </span>
      </td>
      <td className="px-2 py-3">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={cn(
            'inline-flex h-5 w-9 items-center gap-0.5 rounded-full border px-0.5 transition',
            active
              ? 'border-indigo-500/50 bg-indigo-500/30 justify-end'
              : 'border-neutral-300 bg-neutral-200 justify-start'
          )}
        >
          <span
            className={cn(
              'h-3.5 w-3.5 rounded-full transition',
              active ? 'bg-indigo-200' : 'bg-neutral-500'
            )}
          />
        </button>
      </td>
      <td className="px-2 py-3 text-xs text-neutral-500">{formatDate(prompt.createdAt)}</td>
      <td className="px-2 py-3 text-right">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 transition hover:bg-rose-50 hover:text-rose-600"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </td>
    </tr>
  );
}

// =====================================================
// GeneratePromptsButton — modal with count input
// =====================================================
export function GeneratePromptsButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, count }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `生成失败 (${res.status})`);
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-500/20"
      >
        <Sparkles className="h-3.5 w-3.5" /> AI 生成 Prompts
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-300 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-neutral-800">AI 生成 Prompts</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                  生成数量
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1.5 text-xs text-neutral-500">
                  GeoScore 将基于品牌信息、竞品、分类,自动生成最可能被问到的 {count} 个问题。
                </p>
              </div>
              {error ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-500 transition hover:border-neutral-400"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  生成
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

// =====================================================
// ScanNowButton — quick trigger
// =====================================================
export function ScanNowButton({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          platforms: AI_PLATFORMS.map((p) => p.id),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `请求失败 (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        立即扫描
      </button>
      {error ? <span className="text-[10px] text-rose-300">{error}</span> : null}
    </div>
  );
}

// =====================================================
// ScanHistoryClient — expandable scan results
// =====================================================
type ScanLite = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  completedPrompts: number;
  totalPrompts: number;
  platforms: string[];
  triggeredBy: string;
  promptScans: {
    id: string;
    platform: string;
    brandMentioned: boolean;
    brandRank: number | null;
    responseText: string | null;
  }[];
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  queued: { label: '排队中', cls: 'border-neutral-300 bg-neutral-100 text-neutral-500' },
  running: { label: '运行中', cls: 'border-indigo-500/30 bg-indigo-50 text-indigo-600' },
  completed: { label: '已完成', cls: 'border-emerald-500/30 bg-emerald-50 text-emerald-600' },
  failed: { label: '失败', cls: 'border-rose-500/30 bg-rose-50 text-rose-600' },
};

function relativeTime(d: Date | string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  return `${day} 天前`;
}

export function ScanHistoryClient({ scans }: { scans: ScanLite[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="space-y-2">
      {scans.map((s) => {
        const meta = STATUS_META[s.status] ?? STATUS_META.queued;
        const isOpen = openId === s.id;
        const progress = s.totalPrompts
          ? Math.round((s.completedPrompts / s.totalPrompts) * 100)
          : 0;
        return (
          <li
            key={s.id}
            className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 transition hover:border-neutral-300"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : s.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-neutral-500 transition',
                  isOpen && 'rotate-90 text-indigo-500'
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      meta.cls
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {s.completedPrompts} / {s.totalPrompts} 完成 ({progress}%)
                  </span>
                  <span className="text-xs text-neutral-500">·</span>
                  <span className="text-xs text-neutral-500">
                    {relativeTime(new Date(s.startedAt))}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.platforms.map((pid) => {
                    const pm = getPlatformMeta(pid);
                    return (
                      <span
                        key={pid}
                        className="inline-flex items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
                        style={{ borderColor: `${pm.color}40` }}
                      >
                        {pm.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </button>
            {isOpen ? (
              <div className="border-t border-neutral-200 bg-white/40 px-4 py-3">
                {s.promptScans.length === 0 ? (
                  <p className="text-xs text-neutral-500">该次扫描还没有 Prompt 结果。</p>
                ) : (
                  <ul className="space-y-1.5">
                    {s.promptScans.map((ps) => {
                      const pm = getPlatformMeta(ps.platform);
                      return (
                        <li
                          key={ps.id}
                          className="flex items-start gap-2 rounded-lg border border-neutral-300/40 bg-neutral-100 px-3 py-2 text-xs"
                        >
                          <span
                            className="mt-0.5 inline-flex shrink-0 items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
                            style={{ borderColor: `${pm.color}40` }}
                          >
                            {pm.name}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {ps.brandMentioned ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-600">
                                  <Check className="h-2.5 w-2.5" /> 提及
                                  {ps.brandRank ? ` #${ps.brandRank}` : ''}
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-neutral-300/40 px-1.5 py-0.5 text-[10px] text-neutral-500">
                                  未提及
                                </span>
                              )}
                            </div>
                            {ps.responseText ? (
                              <p className="mt-1 line-clamp-2 text-neutral-500">
                                {ps.responseText.slice(0, 200)}
                                {ps.responseText.length > 200 ? '…' : ''}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
