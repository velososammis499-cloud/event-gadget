import { getCachedDateTimeFormat, getCachedRelativeTimeFormat } from '../cache';

const FALLBACK = '—';
const DEFAULT_LOCALE = 'en-US';

export interface FormatTimestampOptions {
  locale?: string;
  timeZone?: string;
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle'];
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle'];
}

export function formatTimestamp(ms: number | null | undefined, options?: FormatTimestampOptions): string {
  if (ms == null || !Number.isFinite(ms)) return FALLBACK;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return FALLBACK;

  const locale = options?.locale ?? DEFAULT_LOCALE;
  const fmtOptions: Intl.DateTimeFormatOptions = {};
  if (options?.timeZone) fmtOptions.timeZone = options.timeZone;
  if (options?.dateStyle) fmtOptions.dateStyle = options.dateStyle;
  if (options?.timeStyle) fmtOptions.timeStyle = options.timeStyle;
  if (!options?.dateStyle && !options?.timeStyle) {
    fmtOptions.dateStyle = 'medium';
    fmtOptions.timeStyle = 'short';
  }

  return getCachedDateTimeFormat(locale, fmtOptions).format(d);
}

export interface FormatRelativeTimeOptions {
  locale?: string;
  timeZone?: string;
  now?: number;
}

/**
 * Format a unix-ms timestamp as a locale-aware relative time string
 * using Intl.RelativeTimeFormat. Falls back to formatTimestamp beyond 7 days.
 */
export function formatRelativeTime(ms: number | null | undefined, options?: FormatRelativeTimeOptions): string {
  if (ms == null || !Number.isFinite(ms)) return FALLBACK;

  const locale = options?.locale ?? DEFAULT_LOCALE;
  const now = options?.now ?? Date.now();
  const diffMs = now - ms;
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const rtf = getCachedRelativeTimeFormat(locale, { numeric: 'auto' });

  if (seconds < 60) {
    return rtf.format(isFuture ? seconds : -seconds, 'second');
  }
  if (minutes < 60) {
    return rtf.format(isFuture ? minutes : -minutes, 'minute');
  }
  if (hours < 24) {
    return rtf.format(isFuture ? hours : -hours, 'hour');
  }
  if (days < 7) {
    return rtf.format(isFuture ? days : -days, 'day');
  }

  return formatTimestamp(ms, { locale, timeZone: options?.timeZone });
}
