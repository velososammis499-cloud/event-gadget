import type { CollectorInit } from '../types';

/**
 * Dwell time collector — tracks how long a user actively views a page.
 *
 * Design decisions:
 * - totalActiveDuration accumulates across visibility changes (tab switch and back)
 * - activeStartAt marks the start of each active period, null when hidden
 * - Heartbeat interval defaults to 15s (not 5s — too frequent, causes event storm)
 * - Heartbeat uses incremental duration since last heartbeat, not total —
 *   server can aggregate. This reduces per-event payload size.
 * - On pagehide: emit final total dwell, reporter handles sendBeacon fallback
 * - On hidden: emit total dwell so far, then pause
 * - On visible: resume timing from now
 *
 * Boundary conditions:
 * - Tab hidden immediately: emits dwell with ~0 duration, then pauses
 * - Multiple hide/show cycles: duration accumulates correctly
 * - Page close without pagehide: visibilitychange hidden fires first as fallback
 */

export const initDwellCollector: CollectorInit = (tracker) => {
  const heartbeatInterval = tracker.config.dwellInterval ?? 15000;

  let totalActiveDuration = 0;
  let activeStartAt: number | null = Date.now();
  let lastHeartbeatAt = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  function getCurrentDuration(): number {
    let duration = totalActiveDuration;
    if (activeStartAt !== null) {
      duration += Date.now() - activeStartAt;
    }
    return duration;
  }

  function emitDwell(heartbeat: boolean): void {
    if (destroyed) return;
    const duration = getCurrentDuration();
    // Heartbeat: send incremental duration since last heartbeat
    // Final: send total accumulated duration
    const payloadDuration = heartbeat ? (Date.now() - lastHeartbeatAt) : duration;
    tracker.emit('dwell', {
      level: 'page',
      path: location.pathname,
      duration: payloadDuration,
      heartbeat,
    });
    if (heartbeat) {
      lastHeartbeatAt = Date.now();
    }
  }

  function onVisibilityChange(): void {
    if (destroyed) return;
    if (document.visibilityState === 'hidden') {
      // Accumulate active time before going inactive
      if (activeStartAt !== null) {
        totalActiveDuration += Date.now() - activeStartAt;
        activeStartAt = null;
      }
      // Emit final dwell for this active period
      emitDwell(false);
    } else {
      // Resume active timing
      activeStartAt = Date.now();
      lastHeartbeatAt = Date.now();
    }
  }

  function onPageHide(): void {
    if (destroyed) return;
    // Accumulate any remaining active time
    if (activeStartAt !== null) {
      totalActiveDuration += Date.now() - activeStartAt;
      activeStartAt = null;
    }
    emitDwell(false);
  }

  timer = setInterval(() => {
    if (activeStartAt !== null) {
      emitDwell(true);
    }
  }, heartbeatInterval);

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    destroyed = true;
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
  };
};
