'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';

type Brand = { id: string; name: string; domain: string | null };

export function BrandSelector({
  brands,
  selectedBrandId,
}: {
  brands: Brand[];
  selectedBrandId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    const sp = new URLSearchParams(params.toString());
    sp.set('brandId', next);
    startTransition(() => {
      router.push(`?${sp.toString()}`);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Globe className="h-4 w-4 text-indigo-500" /> 当前品牌
      </div>
      <select
        value={selectedBrandId}
        onChange={handleChange}
        disabled={isPending}
        className="w-full max-w-xs rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.domain ? ` (${b.domain})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
