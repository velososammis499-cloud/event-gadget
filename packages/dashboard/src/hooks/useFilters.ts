import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export type WindowPreset = 'today' | '7d' | '30d';

export interface FilterState {
  startTime?: number;
  endTime?: number;
  appId?: string;
  /** When set, startTime/endTime are computed from "now" each render so the
   *  window rolls forward on auto-refresh. */
  preset?: WindowPreset;
}

const DAY_MS = 86_400_000;
const APP_ID_KEY = 'eg_dashboard_app_id';
const PRESET_KEY = 'eg_dashboard_preset';

function readStored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* private mode or quota */ }
}

function rangeForPreset(preset: WindowPreset, now: number): { startTime: number; endTime: number } {
  // Snap "now" to a 10-second bucket so React Query keys stay stable between
  // micro-renders. We also push `endTime` ~1 minute into the future so newly
  // arriving events (whose timestamps are slightly after our snap) still fall
  // inside the window before the next bucket boundary triggers a refetch.
  const BUCKET = 10_000;
  const FUTURE_PAD = 60_000;
  const bucketed = Math.floor(now / BUCKET) * BUCKET;
  const endTime = bucketed + FUTURE_PAD;
  if (preset === 'today') {
    const start = new Date(bucketed);
    start.setHours(0, 0, 0, 0);
    return { startTime: start.getTime(), endTime };
  }
  if (preset === '7d') return { startTime: bucketed - 7 * DAY_MS, endTime };
  return { startTime: bucketed - 30 * DAY_MS, endTime };
}

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // First-load restore: if URL has no appId/preset but localStorage does,
  // hydrate the URL once so all downstream queries pick them up. Subsequent
  // edits go through setters below which write both URL and localStorage.
  useEffect(() => {
    const hasUrlAppId = searchParams.has('appId');
    const hasUrlPreset = searchParams.has('preset');
    const hasUrlRange = searchParams.has('startTime') || searchParams.has('endTime');
    if (hasUrlAppId || hasUrlPreset || hasUrlRange) return;

    const storedAppId = readStored(APP_ID_KEY);
    const storedPreset = readStored(PRESET_KEY);
    if (!storedAppId && !storedPreset) return;

    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (storedAppId) next.set('appId', storedAppId);
      if (storedPreset === 'today' || storedPreset === '7d' || storedPreset === '30d') {
        next.set('preset', storedPreset);
      }
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presetRaw = searchParams.get('preset');
  const preset: WindowPreset | undefined =
    presetRaw === 'today' || presetRaw === '7d' || presetRaw === '30d'
      ? presetRaw
      : undefined;

  const filters: FilterState = (() => {
    const base: FilterState = {
      appId: searchParams.get('appId') || undefined,
      preset,
    };
    if (preset) {
      const r = rangeForPreset(preset, Date.now());
      base.startTime = r.startTime;
      base.endTime = r.endTime;
    } else {
      const s = searchParams.get('startTime');
      const e = searchParams.get('endTime');
      if (s) base.startTime = Number(s);
      if (e) base.endTime = Number(e);
    }
    return base;
  })();

  function setFilters(patch: Partial<FilterState>) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (patch.appId !== undefined && patch.appId !== '') {
        next.set('appId', patch.appId);
        writeStored(APP_ID_KEY, patch.appId);
      } else if ('appId' in patch) {
        next.delete('appId');
        writeStored(APP_ID_KEY, null);
      }

      if (patch.preset !== undefined) {
        if (patch.preset === null as unknown as undefined) {
          next.delete('preset');
          writeStored(PRESET_KEY, null);
        } else {
          next.set('preset', patch.preset);
          next.delete('startTime');
          next.delete('endTime');
          writeStored(PRESET_KEY, patch.preset);
        }
      }
      if (patch.startTime !== undefined) { next.set('startTime', String(patch.startTime)); next.delete('preset'); writeStored(PRESET_KEY, null); }
      else if ('startTime' in patch) next.delete('startTime');
      if (patch.endTime !== undefined) { next.set('endTime', String(patch.endTime)); next.delete('preset'); writeStored(PRESET_KEY, null); }
      else if ('endTime' in patch) next.delete('endTime');
      return next;
    }, { replace: true });
  }

  function setPreset(p: WindowPreset) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('preset', p);
      next.delete('startTime');
      next.delete('endTime');
      return next;
    }, { replace: true });
    writeStored(PRESET_KEY, p);
  }

  function setTimeRange(start: number, end: number) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('startTime', String(start));
      next.set('endTime', String(end));
      next.delete('preset');
      return next;
    }, { replace: true });
    writeStored(PRESET_KEY, null);
  }

  return { filters, setFilters, setTimeRange, setPreset };
}
