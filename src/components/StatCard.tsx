import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  subline?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'critical';
  className?: string;
};

const toneStyles: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-neutral-800',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-rose-600',
};

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  subline,
  icon,
  tone = 'default',
  className,
}: StatCardProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const DeltaIcon = !hasDelta ? Minus : delta! > 0 ? ArrowUp : delta! < 0 ? ArrowDown : Minus;
  const deltaTone =
    !hasDelta
      ? 'text-neutral-500'
      : delta! > 0
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : delta! < 0
          ? 'text-rose-700 bg-rose-50 border-rose-200'
          : 'text-neutral-500 bg-neutral-100 border-neutral-200';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-indigo-500/40 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.15)]',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
        {icon ? <div className="text-indigo-500/80">{icon}</div> : null}
      </div>
      <div className={cn('mt-3 text-3xl font-semibold tracking-tight tabular-nums', toneStyles[tone])}>
        {value}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        {hasDelta ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium', deltaTone)}>
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(delta!).toFixed(1)}%
            {deltaLabel ? <span className="text-neutral-500">{deltaLabel}</span> : null}
          </span>
        ) : null}
        {subline ? <span className="text-neutral-500">{subline}</span> : null}
      </div>
    </div>
  );
}

export default StatCard;
