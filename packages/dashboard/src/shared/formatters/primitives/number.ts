import { getCachedNumberFormat } from '../cache';

const FALLBACK = '—';
const DEFAULT_LOCALE = 'en-US';

export function formatNumber(n: number, locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(n)) return FALLBACK;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${getCachedNumberFormat(locale).format(abs)}`;
}

export function formatCompactNumber(n: number, locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(n)) return FALLBACK;
  return getCachedNumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
