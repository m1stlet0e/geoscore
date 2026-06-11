import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 px-6 py-16 text-center',
        className
      )}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-300">
        {icon ?? <Sparkles className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>
      ) : null}
      {children ? <div className="mt-5 w-full max-w-md">{children}</div> : null}
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-500"
        >
          {ctaLabel}
        </Link>
      ) : null}
      {ctaLabel && onCtaClick ? (
        <button
          onClick={onCtaClick}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-400 hover:to-violet-500"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

export default EmptyState;
