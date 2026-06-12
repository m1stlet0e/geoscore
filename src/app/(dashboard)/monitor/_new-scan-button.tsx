'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, X, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Brand = { id: string; name: string };
type Platform = { id: string; name: string; color: string };

export function NewScanButton({
  brands,
  platforms,
}: {
  brands: Brand[];
  platforms: Platform[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(platforms.map((p) => p.id)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const togglePlatform = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) {
      setError('请选择一个品牌');
      return;
    }
    if (selected.size === 0) {
      setError('请至少选择一个 AI 平台');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          platforms: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `请求失败 (${res.status})`);
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400"
      >
        <Plus className="h-4 w-4" /> 新建扫描
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-neutral-300 bg-neutral-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-300 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-800">新建扫描</h3>
                  <p className="text-xs text-neutral-500">跨 7 大 AI 引擎同时发起一次全面扫描</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-5">
              {/* Brand select */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                  选择品牌
                </label>
                {brands.length === 0 ? (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-600">
                    请先添加品牌
                  </p>
                ) : (
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Platform multi-select */}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                  选择 AI 平台 ({selected.size}/{platforms.length})
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {platforms.map((p) => {
                    const isOn = selected.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        disabled={submitting}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
                          isOn
                            ? 'border-indigo-500/50 bg-indigo-50 text-neutral-900'
                            : 'border-neutral-300 bg-white/40 text-neutral-500 hover:border-neutral-400'
                        )}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="flex-1 text-left">{p.name}</span>
                        {isOn ? <Check className="h-3.5 w-3.5 text-indigo-500" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 py-2 text-sm font-medium text-neutral-500 transition hover:border-neutral-400"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting || brands.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  开始扫描
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
