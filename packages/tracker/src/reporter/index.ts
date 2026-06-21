import type { TrackEvent, TrackBatch, TrackerConfig, NavigationChain } from '../types';

const DEFAULT_BATCH_INTERVAL = 5000;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_MAX_QUEUE = 100;
const DEFAULT_MAX_RETRIES = 3;

interface QueueItem {
  event: TrackEvent;
  retries: number;
}

interface ReporterConfig {
  endpoint: string;
  appId: string;
  batchInterval: number;
  batchSize: number;
  maxQueueSize: number;
  maxRetries: number;
  debug: boolean;
}

function resolveConfig(raw: TrackerConfig): ReporterConfig {
  return {
    endpoint: raw.endpoint,
    appId: raw.appId,
    batchInterval: raw.batchInterval ?? DEFAULT_BATCH_INTERVAL,
    batchSize: raw.batchSize ?? DEFAULT_BATCH_SIZE,
    maxQueueSize: raw.maxQueueSize ?? DEFAULT_MAX_QUEUE,
    maxRetries: raw.maxRetries ?? DEFAULT_MAX_RETRIES,
    debug: raw.debug ?? false,
  };
}

export class Reporter {
  private queue: QueueItem[] = [];
  private flushing = false;
  private destroyed = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private config: ReporterConfig;
  private getChain: () => NavigationChain;
  private getUserId: () => string | undefined;

  constructor(
    rawConfig: TrackerConfig,
    getChain: () => NavigationChain,
    getUserId: () => string | undefined,
  ) {
    this.config = resolveConfig(rawConfig);
    this.getChain = getChain;
    this.getUserId = getUserId;

    this.timer = setInterval(() => this.flush(), this.config.batchInterval);

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
  }

  enqueue(event: TrackEvent): void {
    if (this.destroyed) return;

    this.queue.push({ event, retries: 0 });

    if (this.queue.length > this.config.maxQueueSize) {
      this.queue = this.queue.slice(-this.config.maxQueueSize);
    }

    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.destroyed || this.queue.length === 0) return;
    this.flushing = true;

    try {
      const items = this.queue.splice(0, this.config.batchSize);
      const sent = await this.sendViaFetch(items.map((i) => i.event));

      if (!sent) {
        // Re-queue only items still under retry limit; order preserved by unshift
        // (safe because the lock prevents concurrent flush from interleaving)
        for (const item of items) {
          if (item.retries + 1 < this.config.maxRetries) {
            this.queue.unshift({ event: item.event, retries: item.retries + 1 });
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /** Synchronous flush — only used on page unload. Drains entire queue via sendBeacon. */
  private flushSync(): void {
    if (this.destroyed || this.queue.length === 0) return;

    const items = this.queue.splice(0, this.queue.length);
    const batch: TrackBatch = {
      appId: this.config.appId,
      sessionId: this.getChain().sessionId,
      userId: this.getUserId(),
      events: items.map((i) => i.event),
      chain: this.getChain(),
    };

    const json = JSON.stringify(batch);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.config.endpoint, new Blob([json], { type: 'application/json' }));
    }
  }

  private async sendViaFetch(events: TrackEvent[]): Promise<boolean> {
    const batch: TrackBatch = {
      appId: this.config.appId,
      sessionId: this.getChain().sessionId,
      userId: this.getUserId(),
      events,
      chain: this.getChain(),
    };
    const json = JSON.stringify(batch);

    try {
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        body: json,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  destroy(): void {
    if (this.destroyed) return;

    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.onPageHide);

    // Final flush before marking destroyed
    this.flushSync();
    this.destroyed = true;
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flushSync();
    }
  };

  private onPageHide = (): void => {
    this.flushSync();
  };
}
