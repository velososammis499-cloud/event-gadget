import type { CollectorInit } from '../types';
import { readableLabel } from '../utils/readable-label';
import { shouldDropEvent } from '../utils/sensitive-fields';

export const initImpressionCollector: CollectorInit = (tracker) => {
  const selector = tracker.config.trackableSelector || '[data-track],[data-track-impression]';
  const threshold = tracker.config.impressionThreshold ?? 0.5;
  const debounceMs = tracker.config.impressionDebounce ?? 300;

  // Keyed by current view path (path + #view=...) — switching tab/view gives a new bucket,
  // so the same element legitimately gets one impression per view.
  const seenByView = new Map<string, WeakSet<Element>>();
  function seenSet(): WeakSet<Element> {
    const key = tracker.getPageInfo().path;
    let set = seenByView.get(key);
    if (!set) { set = new WeakSet(); seenByView.set(key, set); }
    return set;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Array<{ element: Element; ratio: number; enteredAt: number }> = [];

  const observer = new IntersectionObserver(
    (entries) => {
      const seen = seenSet();
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        if (seen.has(el)) continue;
        if (shouldDropEvent(el)) { seen.add(el); continue; }
        seen.add(el);
        pending.push({
          element: el,
          ratio: entry.intersectionRatio,
          enteredAt: Date.now(),
        });
      }
      if (pending.length === 0) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    { threshold },
  );

  function flush(): void {
    const items = pending.splice(0);
    for (const { element, ratio, enteredAt } of items) {
      tracker.emit('impression', {
        tagName: (element as HTMLElement).tagName,
        text: readableLabel(element),
        id: (element as HTMLElement).id || undefined,
        className: typeof (element as HTMLElement).className === 'string' ? (element as HTMLElement).className : undefined,
        dataTrack: element.getAttribute('data-track') || undefined,
        visibleRatio: ratio,
        visibleTime: Date.now() - enteredAt,
      });
    }
  }

  function scan(): void {
    document.querySelectorAll(selector).forEach((el) => observer.observe(el));
  }

  const mutationObserver = new MutationObserver(() => {
    scan();
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  scan();

  return () => {
    observer.disconnect();
    mutationObserver.disconnect();
    if (timer) clearTimeout(timer);
  };
};
