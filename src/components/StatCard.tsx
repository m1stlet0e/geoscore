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
  default: 'text-slate-200',
  positive: 'text-emerald-300',
  warning: 'text-amber-300',
  critical: 'text-rose-300',
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
      ? 'text-slate-400'
      : delta! > 0
        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
        : delta! < 0
          ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
          : 'text-slate-400 bg-slate-500/10 border-slate-500/20';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-800/70 bg-gradient-to-b from-slate-900/80 to-slate-950/60 p-5 transition hover:border-indigo-500/40 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.15)]',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
        {icon ? <div className="text-indigo-300/80">{icon}</div> : null}
      </div>
      <div className={cn('mt-3 text-3xl font-semibold tracking-tight tabular-nums', toneStyles[tone])}>
        {value}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {hasDelta ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium', deltaTone)}>
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(delta!).toFixed(1)}%
            {deltaLabel ? <span className="text-slate-400">{deltaLabel}</span> : null}
          </span>
        ) : null}
        {subline ? <span className="text-slate-500">{subline}</span> : null}
      </div>
    </div>
  );
}

export default StatCard;
