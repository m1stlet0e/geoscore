'use client';

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// FadeIn — Entrance animation wrapper
// ============================================
interface FadeInProps {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  delay?: number;
  duration?: number;
  className?: string;
  style?: CSSProperties;
}

export function FadeIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 500,
  className,
  style,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const getTransform = () => {
    switch (direction) {
      case 'up':
        return 'translateY(20px)';
      case 'down':
        return 'translateY(-20px)';
      case 'left':
        return 'translateX(20px)';
      case 'right':
        return 'translateX(-20px)';
      case 'none':
        return 'none';
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : getTransform(),
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// StaggerChildren — Staggered animation container
// ============================================
interface StaggerChildrenProps {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggerChildren({
  children,
  staggerDelay = 60,
  className,
}: StaggerChildrenProps) {
  return (
    <div className={cn('stagger', className)} style={{ '--stagger-delay': `${staggerDelay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

// ============================================
// ScaleIn — Scale entrance animation
// ============================================
interface ScaleInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function ScaleIn({ children, delay = 0, className }: ScaleInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.95)',
        transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// SlideIn — Slide entrance animation
// ============================================
interface SlideInProps {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  distance?: number;
  className?: string;
}

export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  distance = 100,
  className,
}: SlideInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const getTransform = () => {
    switch (direction) {
      case 'up':
        return `translateY(${distance}px)`;
      case 'down':
        return `translateY(-${distance}px)`;
      case 'left':
        return `translateX(${distance}px)`;
      case 'right':
        return `translateX(-${distance}px)`;
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : getTransform(),
        transition: `opacity 500ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// AnimatedNumber — Counter animation
// ============================================
interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function AnimatedNumber({
  value,
  duration = 1000,
  className,
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.floor(eased * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVisible, value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

// ============================================
// Skeleton — Loading placeholder
// ============================================
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({
  className,
  width,
  height,
  rounded = 'md',
}: SkeletonProps) {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={cn('skeleton', roundedClass, className)}
      style={{
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }}
    />
  );
}

// ============================================
// SkeletonCard — Card loading placeholder
// ============================================
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('surface p-6 space-y-4', className)}>
      <Skeleton width={120} height={16} />
      <Skeleton width="60%" height={32} />
      <Skeleton width="80%" height={16} />
    </div>
  );
}

// ============================================
// SkeletonTable — Table loading placeholder
// ============================================
export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton
              key={j}
              className="flex-1"
              height={40}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================
// PulseDot — Animated status indicator
// ============================================
interface PulseDotProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PulseDot({ color = '#22c55e', size = 'md', className }: PulseDotProps) {
  const sizeClass = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  }[size];

  return (
    <span className={cn('relative inline-flex', className)}>
      <span
        className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', sizeClass)}
        style={{ backgroundColor: color }}
      />
      <span
        className={cn('relative inline-flex rounded-full', sizeClass)}
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

// ============================================
// FloatingElement — Subtle floating animation
// ============================================
interface FloatingElementProps {
  children: ReactNode;
  duration?: number;
  delay?: number;
  distance?: number;
  className?: string;
}

export function FloatingElement({
  children,
  duration = 3,
  delay = 0,
  distance = 8,
  className,
}: FloatingElementProps) {
  return (
    <div
      className={className}
      style={{
        animation: `float ${duration}s ease-in-out ${delay}s infinite`,
        '--float-distance': `${distance}px`,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}

// ============================================
// ProgressBar — Animated progress
// ============================================
interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  color,
  height = 4,
  className,
  showLabel = false,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1 text-sm text-neutral-600">
          <span>{value}</span>
          <span>{max}</span>
        </div>
      )}
      <div
        className="progress-bar"
        style={{ height: `${height}px` }}
      >
        <div
          className="progress-bar-fill"
          style={{
            width: `${percentage}%`,
            background: color ? color : undefined,
          }}
        />
      </div>
    </div>
  );
}

// ============================================
// Tooltip — Hover tooltip
// ============================================
interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className,
}: TooltipProps) {
  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  return (
    <div className={cn('relative group', className)}>
      {children}
      <div
        className={cn(
          'absolute z-50 px-3 py-1.5 text-sm text-white bg-neutral-900 rounded-lg',
          'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
          'transition-all duration-200',
          positionStyles
        )}
      >
        {content}
        <div
          className={cn(
            'absolute w-2 h-2 bg-neutral-900 rotate-45',
            position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
            position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
            position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
            position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
          )}
        />
      </div>
    </div>
  );
}

// ============================================
// AnimatedList — List with staggered animation
// ============================================
interface AnimatedListProps {
  children: ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export function AnimatedList({
  children,
  staggerDelay = 60,
  className,
}: AnimatedListProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn key={index} delay={index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
}

// ============================================
// Counter — Animated counter with formatting
// ============================================
interface CounterProps {
  value: number;
  format?: 'number' | 'currency' | 'percentage';
  currency?: string;
  duration?: number;
  className?: string;
}

export function Counter({
  value,
  format = 'number',
  currency = 'USD',
  duration = 1000,
  className,
}: CounterProps) {
  const formatValue = (num: number) => {
    switch (format) {
      case 'number':
        return num.toLocaleString();
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(num);
      case 'percentage':
        return `${num.toFixed(1)}%`;
    }
  };

  return (
    <AnimatedNumber
      value={value}
      duration={duration}
      className={className}
    />
  );
}
