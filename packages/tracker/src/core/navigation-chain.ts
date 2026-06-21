import { MAX_CHAIN_LENGTH, type ChainEntry, type NavigationChain, type SourceInfo } from '../types';

const STORAGE_KEY = '__sg_nav_chain';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function createEntry(viewPath?: string): ChainEntry {
  return {
    path: viewPath ?? location.pathname + location.hash,
    search: location.search,
    hash: location.hash,
    title: document.title,
    enteredAt: Date.now(),
  };
}

export class NavigationChainManager {
  private chain: NavigationChain;
  private firstSource: SourceInfo | null = null;

  constructor() {
    this.chain = this.loadOrCreate();
  }

  private loadOrCreate(): NavigationChain {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const chain = JSON.parse(raw) as NavigationChain;
        if (chain.entries && chain.entries.length > 0) return chain;
      }
    } catch { /* ignore */ }

    const chain: NavigationChain = {
      sessionId: generateId(),
      entries: [],
    };

    this.firstSource = this.determineFirstSource();

    const entry = createEntry();
    chain.entries.push(entry);

    this.save(chain);
    return chain;
  }

  private determineFirstSource(): SourceInfo {
    const referrer = document.referrer;
    if (!referrer) return { type: 'direct' };

    try {
      const refUrl = new URL(referrer);
      if (refUrl.origin === location.origin) {
        return {
          type: 'internal',
          path: refUrl.pathname,
          search: refUrl.search,
          chainIndex: -1,
        };
      }
      return { type: 'external', referrerUrl: referrer };
    } catch {
      return { type: 'direct' };
    }
  }

  onNavigation(viewPath?: string): { source: SourceInfo; newEntry: ChainEntry } {
    const lastEntry = this.chain.entries[this.chain.entries.length - 1];
    const source: SourceInfo = {
      type: 'internal',
      path: lastEntry.path,
      search: lastEntry.search,
      title: lastEntry.title,
      chainIndex: this.chain.entries.length - 1,
    };

    const newEntry = createEntry(viewPath);
    this.chain.entries.push(newEntry);

    // Trim oldest entries when chain exceeds max length
    if (this.chain.entries.length > MAX_CHAIN_LENGTH) {
      this.chain.entries = this.chain.entries.slice(-MAX_CHAIN_LENGTH);
    }

    this.save(this.chain);

    return { source, newEntry };
  }

  getSource(): SourceInfo {
    if (this.chain.entries.length <= 1) {
      return this.firstSource || { type: 'direct' };
    }

    const prev = this.chain.entries[this.chain.entries.length - 2];
    return {
      type: 'internal',
      path: prev.path,
      search: prev.search,
      title: prev.title,
      chainIndex: this.chain.entries.length - 2,
    };
  }

  getChain(): NavigationChain {
    return { ...this.chain, entries: [...this.chain.entries] };
  }

  getSessionId(): string {
    return this.chain.sessionId;
  }

  updateCurrentTitle(title: string): void {
    const last = this.chain.entries[this.chain.entries.length - 1];
    if (last) {
      last.title = title;
      this.save(this.chain);
    }
  }

  private save(chain: NavigationChain): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chain));
    } catch { /* quota exceeded, ignore */ }
  }
}
