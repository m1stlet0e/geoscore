'use client';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Check } from 'lucide-react';
import { useState } from 'react';

export function MarkAllReadButton({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!hasUnread) return null;
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/alerts?isRead=false', { method: 'GET' }); // not used
        router.refresh();
        setBusy(false);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 transition hover:border-slate-700 hover:text-slate-100 disabled:opacity-50"
    >
      <CheckCircle2 className="h-3.5 w-3.5" /> 全部标记已读
    </button>
  );
}

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/alerts/${id}/read`, { method: 'PATCH' });
        router.refresh();
        setBusy(false);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:opacity-50"
    >
      <Check className="h-3 w-3" /> 已读
    </button>
  );
}
