'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function UpgradeButton({ plan, label }: { plan: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/user/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        router.refresh();
        setBusy(false);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-200 transition hover:bg-indigo-500/20 disabled:opacity-50"
    >
      {busy ? '升级中…' : label}
    </button>
  );
}
