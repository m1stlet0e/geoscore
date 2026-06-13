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

export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function normalizePagination(
  pagination: (Partial<PaginationInfo> & { pages?: number }) | null | undefined
): PaginationInfo | null {
  if (!pagination) return null;
  return {
    page: pagination.page ?? 1,
    limit: pagination.limit ?? 20,
    total: pagination.total ?? 0,
    totalPages: pagination.totalPages ?? pagination.pages ?? 1,
  };
}

export function normalizeTrend(trend: string | undefined): 'up' | 'down' | 'stable' {
  if (trend === 'up' || trend === 'improving' || trend === 'increasing') return 'up';
  if (trend === 'down' || trend === 'worsening' || trend === 'decreasing') return 'down';
  return 'stable';
}

export function normalizeGapAnalysis<T extends Record<string, unknown>>(analysis: T) {
  const row = analysis as T & { benchmark?: number; benchmarkScore?: number };
  return {
    ...analysis,
    benchmarkScore: row.benchmarkScore ?? row.benchmark ?? 0,
  };
}
