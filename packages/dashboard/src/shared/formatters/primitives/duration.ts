const FALLBACK = '—';

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return FALLBACK;

  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours === 0) return `${minutes}m ${seconds}s`;
  return `${hours}h ${minutes}m`;
}

export function formatRatioAsPercent(value: number, options?: { fractionDigits?: number; inputIsPercentage?: boolean }): string {
  if (!Number.isFinite(value)) return FALLBACK;
  const scaled = options?.inputIsPercentage ? value : value * 100;
  return `${scaled.toFixed(options?.fractionDigits ?? 1)}%`;
}
