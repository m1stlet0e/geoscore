import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

const sizeMap = {
  sm: { mark: 20, text: 'text-sm' },
  md: { mark: 28, text: 'text-base' },
  lg: { mark: 36, text: 'text-xl' },
};

/**
 * GeoScore logo — abstract "G" / orbital ring mark.
 * Pure inline SVG (no external asset), scales to any size.
 */
export function Logo({ className, showWordmark = true, size = 'md' }: LogoProps) {
  const s = sizeMap[size];
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="geoscore-mark-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#a5b4fc" />
            <stop offset="0.5" stopColor="#6366f1" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="geoscore-mark-core" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#818cf8" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
        </defs>
        {/* outer orbital ring */}
        <circle cx="20" cy="20" r="17" stroke="url(#geoscore-mark-grad)" strokeWidth="2.2" opacity="0.9" />
        {/* dashed tracking arc */}
        <circle
          cx="20"
          cy="20"
          r="12.5"
          stroke="url(#geoscore-mark-grad)"
          strokeWidth="1.4"
          strokeDasharray="2.4 3.4"
          opacity="0.55"
        />
        {/* G core */}
        <path
          d="M27.2 20a7.2 7.2 0 1 1-3.5-6.1"
          stroke="url(#geoscore-mark-core)"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
        {/* inner node */}
        <circle cx="20" cy="20" r="2.4" fill="#e0e7ff" />
        {/* satellite dot */}
        <circle cx="33.6" cy="11.6" r="1.6" fill="#a5b4fc" />
      </svg>
      {showWordmark ? (
        <span className={cn('font-semibold tracking-tight text-neutral-900', s.text)}>
          Geo<span className="text-indigo-500">Score</span>
        </span>
      ) : null}
    </span>
  );
}

export default Logo;
