import type { CollectorInit } from '../types';
import { readableLabel } from '../utils/readable-label';
import { shouldDropEvent } from '../utils/sensitive-fields';

export const initClickCollector: CollectorInit = (tracker) => {
  function handler(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target) return;

    const element = target.closest('a, button, [role="button"], [data-track], input[type="submit"]') || target;

    if (shouldDropEvent(target) || shouldDropEvent(element)) return;

    tracker.emit('click', {
      tagName: element.tagName,
      text: readableLabel(element),
      id: element.id || undefined,
      className: typeof element.className === 'string' ? element.className : undefined,
      href: (element as HTMLAnchorElement).href || undefined,
      dataTrack: element.getAttribute('data-track') || undefined,
    });
  }

  document.addEventListener('click', handler, true);

  return () => document.removeEventListener('click', handler, true);
};
