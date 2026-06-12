import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { FadeIn, FloatingElement } from '@/components/animations';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
};

export function EmptyState({ icon, title, description, action, ctaLabel, ctaHref, className }: EmptyStateProps) {
  return (
    <FadeIn>
      <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
        {icon && (
          <FloatingElement duration={3} distance={6}>
            <div className="mb-4 text-5xl opacity-80">
              {icon}
            </div>
          </FloatingElement>
        )}
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-neutral-500 max-w-md mb-6">
            {description}
          </p>
        )}
        {action && (
          <div className="animate-bounce-subtle">
            {action}
          </div>
        )}
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="btn-primary inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </FadeIn>
  );
}

export default EmptyState;
