import { NavigationChainManager } from './navigation-chain';
import { SessionContext } from './context';
import { Reporter } from '../reporter';
import { getSchema } from '../types';
import type {
  TrackerConfig,
  TrackerCore,
  EventType,
  PayloadOf,
  TrackEvent,
  SourceInfo,
  PageInfo,
  NavigationChain,
  DeviceInfo,
  CollectorInit,
} from '../types';

const DEFAULTS: Omit<TrackerConfig, 'endpoint' | 'appId'> = {
  batchInterval: 5000,
  batchSize: 10,
  maxQueueSize: 100,
  maxRetries: 3,
  validate: true,
  debug: false,
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const VIEW_SELECTORS = [
  '[aria-current="page"]',
  '[aria-current="true"]',
  '[aria-selected="true"]',
  '.menu-item.active',
  '.nav-item.active',
  '.tab.active',
  '.tab-item.active',
  'nav .active',
  '[role="tab"].active',
  // Vue Router 默认类名
  '.router-link-active',
  '.router-link-exact-active',
  // 通用 framework / BEM 命名
  '.is-active',
  '.selected',
  '.current',
  '.active-tab',
  '.tab--active',
  '.tab__active',
];

const VIEW_BREADCRUMB_SELECTORS = [
  '.breadcrumb [aria-current]',
  '.breadcrumb > :last-child',
  '.breadcrumb .current',
  'nav[aria-label="breadcrumb"] [aria-current]',
];

function cleanLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // strip emoji + control chars, collapse whitespace
  const cleaned = raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > 80) return cleaned ? cleaned.slice(0, 80) : null;
  return cleaned;
}

function detectViewLabel(): string | null {
  // 1) breadcrumb current segment — most explicit signal
  for (const sel of VIEW_BREADCRUMB_SELECTORS) {
    const el = document.querySelector(sel);
    const txt = cleanLabel(el?.textContent);
    if (txt) return txt;
  }

  // 2) active tab/menu item — 多个命中时,优先 nav/tablist 内最深的元素;实在不唯一才放弃
  for (const sel of VIEW_SELECTORS) {
    const matches = document.querySelectorAll(sel);
    if (matches.length === 0) continue;
    if (matches.length === 1) {
      const txt = cleanLabel(matches[0].textContent);
      if (txt) return txt;
      continue;
    }
    // 多个命中:取 nav 内层级最深的;再不行取 tablist 内层级最深的
    const pickDeepest = (containerSel: string): Element | null => {
      let best: Element | null = null;
      let bestDepth = -1;
      for (const el of Array.from(matches)) {
        const c = el.closest(containerSel);
        if (!c) continue;
        let depth = 0;
        let n: Element | null = el;
        while (n && n !== c) { depth++; n = n.parentElement; }
        if (depth > bestDepth) { bestDepth = depth; best = el; }
      }
      return best;
    };
    const picked = pickDeepest('nav') || pickDeepest('[role="tablist"]');
    if (picked) {
      const txt = cleanLabel(picked.textContent);
      if (txt) return txt;
    }
    // 多个命中且无 nav/tablist 容器 — 不拼接,继续下一个 selector
  }

  // 3) document.title prefix
  const title = document.title;
  const sep = title.search(/[-|·/]\s*[\S]/);
  if (sep > 0) {
    const txt = cleanLabel(title.slice(0, sep));
    if (txt) return txt;
  }

  return null;
}

export class Tracker implements TrackerCore {
  config: TrackerConfig;
  private chainManager: NavigationChainManager;
  private context: SessionContext;
  private collectors: (() => void)[] = [];
  private reporter: Reporter | null = null;
  private lastUrl: string;
  private viewLabel: string | null = null;
  private viewSource: 'manual' | 'inferred' | null = null;

  constructor(config: TrackerConfig) {
    this.config = { ...DEFAULTS, ...config };

    this.chainManager = new NavigationChainManager();
    this.context = new SessionContext();
    // Seed lastUrl with the initial URL so the first inferView() only fires a
    // viewchange pageview if it actually finds a label (else it's a no-op).
    this.lastUrl = location.pathname + location.search + location.hash + '::';

    if (config.userId) {
      this.setUserId(typeof config.userId === 'function' ? config.userId() : config.userId);
    }

    this.reporter = new Reporter(
      this.config,
      () => this.chainManager.getChain(),
      () => this.context.userId,
    );

    if (this.config.debug) {
      console.log('[Event Gadget] initialized, sessionId:', this.chainManager.getSessionId());
    }
  }

  init(collectors: CollectorInit[]): void {
    for (const init of collectors) {
      const cleanup = init(this);
      if (cleanup) this.collectors.push(cleanup);
    }
  }

  emit<T extends EventType>(type: T, payload: PayloadOf<T>): void {
    if (this.config.validate !== false) {
      const schema = getSchema(type);
      if (schema) {
        const result = schema.safeParse(payload);
        if (!result.success) {
          if (this.config.debug) {
            console.warn(`[Event Gadget] payload validation failed for "${type}":`, result.error.issues);
          }
          return;
        }
      }
    }

    const event: TrackEvent = {
      id: generateId(),
      type,
      schemaVersion: 1,
      timestamp: Date.now(),
      sessionId: this.chainManager.getSessionId(),
      appId: this.config.appId,
      userId: this.context.userId,
      visitorId: this.context.visitorId,
      isNewVisitor: this.context.isNewVisitor,
      device: this.context.getDeviceInfo(),
      page: this.getPageInfo(),
      source: this.getSource(),
      payload,
    };

    if (this.config.debug) {
      console.log('[Event Gadget] event:', event.type, event.page.path, event.payload);
    }

    this.reporter?.enqueue(event);
  }

  getSource(): SourceInfo {
    return this.chainManager.getSource();
  }

  getChain(): NavigationChain {
    return this.chainManager.getChain();
  }

  getPageInfo(): PageInfo {
    const base = location.pathname + location.hash;
    // Use a non-hash delimiter so URLs with a hash route don't end up with two '#'s.
    // The dashboard's displayPath helper recognizes both old "#view=" and new "?view=" forms.
    const path = this.viewLabel ? `${base}?view=${encodeURIComponent(this.viewLabel)}` : base;
    return {
      path,
      search: location.search,
      hash: location.hash,
      title: document.title,
    };
  }

  getDeviceInfo(): DeviceInfo {
    return this.context.getDeviceInfo();
  }

  setUserId(userId: string): void {
    this.context.setUserId(userId);
  }

  setView(label: string | null): void {
    const next = label && label.trim() ? label.trim().slice(0, 80) : null;
    if (next === this.viewLabel) return;
    this.viewLabel = next;
    this.viewSource = next ? 'manual' : null;
    this.scheduleNavCommit('viewchange');
  }

  /** Best-effort view-label inference. Called by the page-view collector when:
   *  - URL stays the same but DOM structure changes (tab switch via display:none/block)
   *  - document.title changes
   *  Only overwrites when the current viewLabel was inferred — never clobbers a manual setView. */
  inferView(): void {
    if (this.viewSource === 'manual') return;
    const next = detectViewLabel();
    if (next === this.viewLabel) return;
    this.viewLabel = next;
    this.viewSource = next ? 'inferred' : null;
    this.scheduleNavCommit('viewchange');
  }

  /** Deduplicated commit pipeline.
   *
   *  A single user navigation can fire popstate + hashchange + a DOM mutation
   *  triggering inferView, all within ~60ms. We collapse them into ONE chain
   *  entry + ONE pageview by:
   *    1. Recording the most recent trigger label.
   *    2. Scheduling a single commit on the next tick (~80ms debounce window).
   *    3. At commit time, comparing the final URL+viewLabel to the last
   *       committed state; if unchanged, skip everything.
   *
   *  This eliminates the popstate/hashchange double-fire and the self-loop
   *  pageviews that came with it. */
  private navTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTrigger: string | null = null;

  private scheduleNavCommit(trigger: string): void {
    // Most informative trigger wins — explicit viewchange beats popstate.
    const priority: Record<string, number> = {
      init: 0, popstate: 1, hashchange: 1, pushState: 2, replaceState: 2, viewchange: 3,
    };
    if (
      this.pendingTrigger === null ||
      (priority[trigger] ?? 0) > (priority[this.pendingTrigger] ?? 0)
    ) {
      this.pendingTrigger = trigger;
    }
    if (this.navTimer) {
      // A later, higher-priority trigger arrived — reset the timer so we wait
      // for any further updates (e.g. inferView running ~60ms after a URL change).
      clearTimeout(this.navTimer);
    }
    this.navTimer = setTimeout(() => {
      this.navTimer = null;
      const trig = this.pendingTrigger ?? 'pushState';
      this.pendingTrigger = null;
      this.commitNav(trig);
    }, 150);
  }

  private commitNav(trigger: string): void {
    const newUrl = location.pathname + location.search + location.hash + '::' + (this.viewLabel ?? '');
    if (newUrl === this.lastUrl) return;
    this.lastUrl = newUrl;

    this.chainManager.updateCurrentTitle(document.title);
    const viewPath = this.getPageInfo().path;
    this.chainManager.onNavigation(viewPath);
    this.emit('pageview', { trigger: trigger as 'pushState' });
  }

  handleRouteChange(trigger: string): void {
    // URL just changed — any "inferred" viewLabel is stale.
    // (Manual setView persists across URL changes by design.)
    if (this.viewSource === 'inferred') {
      this.viewLabel = null;
      this.viewSource = null;
    }
    this.scheduleNavCommit(trigger);
  }

  destroy(): void {
    for (const cleanup of this.collectors) cleanup();
    this.collectors = [];
    this.reporter?.destroy();
  }
}
