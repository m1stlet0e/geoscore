import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FadeIn } from '@/components/animations';

type PageHeaderProps = {
  eyebrow?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <FadeIn direction="left" delay={0}>
        <div>
          {eyebrow && (
            <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
              {eyebrow}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-neutral-500 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </FadeIn>
      {actions && (
        <FadeIn direction="right" delay={100}>
          <div className="flex items-center gap-3">
            {actions}
          </div>
        </FadeIn>
      )}
    </div>
  );
}

export default PageHeader;
