/**
 * Internal LRU cache for formatter instances.
 * Prevents unbounded memory growth from locale/currency/timezone permutations.
 */

const MAX_SIZE = 50;

export class FormatterCache<V> {
  private map = new Map<string, V>();

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= MAX_SIZE) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, value);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

const numberFmtCache = new FormatterCache<Intl.NumberFormat>();
const dateTimeFmtCache = new FormatterCache<Intl.DateTimeFormat>();
const relativeTimeFmtCache = new FormatterCache<Intl.RelativeTimeFormat>();

export function getCachedNumberFormat(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options ?? {})}`;
  let fmt = numberFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    numberFmtCache.set(key, fmt);
  }
  return fmt;
}

export function getCachedDateTimeFormat(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options ?? {})}`;
  let fmt = dateTimeFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    dateTimeFmtCache.set(key, fmt);
  }
  return fmt;
}

export function getCachedRelativeTimeFormat(locale: string, options?: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat {
  const key = `${locale}:${JSON.stringify(options ?? {})}`;
  let fmt = relativeTimeFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, options);
    relativeTimeFmtCache.set(key, fmt);
  }
  return fmt;
}
