import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string | number | null | undefined) {
  if (!d) return '-';
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return '-';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}
