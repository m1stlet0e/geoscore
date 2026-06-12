import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber, FadeIn } from '@/components/animations';

type StatCardProps = {
  label: string;
  value: ReactNode;
  delta?: number;
  deltaLabel?: string;
  subline?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'critical';
  className?: string;
  delay?: number;
};

const toneStyles: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-neutral-800',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-rose-600',
};

const toneIconBg: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-indigo-50',
  positive: 'bg-emerald-50',
  warning: 'bg-amber-50',
  critical: 'bg-rose-50',
};

const toneIconColor: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-indigo-600',
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
  delay = 0,
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
    <FadeIn delay={delay}>
      <div
        className={cn(
          'surface-raised p-6 hover-lift group',
          className
        )}
      >
        {/* Icon */}
        {icon && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-neutral-500">{label}</span>
            <div className={cn('p-2 rounded-lg transition-transform group-hover:scale-110', toneIconBg[tone])}>
              <span className={toneIconColor[tone]}>{icon}</span>
            </div>
          </div>
        )}

        {/* Value */}
        <div className={cn('metric-value text-3xl', toneStyles[tone])}>
          {typeof value === 'number' ? (
            <AnimatedNumber value={value} duration={800} />
          ) : (
            value
          )}
        </div>

        {/* Delta badge */}
        {hasDelta && (
          <div className="mt-3">
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', deltaTone)}>
              <DeltaIcon className="h-3 w-3" />
              {Math.abs(delta!).toFixed(1)}%
              {deltaLabel && <span className="text-neutral-500">{deltaLabel}</span>}
            </span>
          </div>
        )}

        {/* Subline */}
        {subline && (
          <p className="mt-3 text-sm text-neutral-500">{subline}</p>
        )}
      </div>
    </FadeIn>
  );
}

export default StatCard;
