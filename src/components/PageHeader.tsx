import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, eyebrow, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 border-b border-slate-800/60 pb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-indigo-200">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-400">{subtitle}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
