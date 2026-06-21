import { getCachedNumberFormat } from '../cache';

const FALLBACK = '—';
const DEFAULT_LOCALE = 'en-US';

export function formatCurrency(n: number, options?: { locale?: string; currency?: string; minimumFractionDigits?: number; maximumFractionDigits?: number }): string {
  if (!Number.isFinite(n)) return FALLBACK;
  return getCachedNumberFormat(options?.locale ?? DEFAULT_LOCALE, {
    style: 'currency',
    currency: options?.currency ?? 'USD',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(n);
}

export function formatCompactCurrency(n: number, options?: { locale?: string; currency?: string }): string {
  if (!Number.isFinite(n)) return FALLBACK;
  return getCachedNumberFormat(options?.locale ?? DEFAULT_LOCALE, {
    style: 'currency',
    currency: options?.currency ?? 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}
