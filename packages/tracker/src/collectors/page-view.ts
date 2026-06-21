import type { CollectorInit } from '../types';

export const initPageViewCollector: CollectorInit = (tracker) => {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
    originalPushState.call(history, state, title, url);
    tracker.handleRouteChange('pushState');
  };

  history.replaceState = function (state: unknown, title: string, url?: string | URL | null) {
    originalReplaceState.call(history, state, title, url);
    tracker.handleRouteChange('replaceState');
  };

  const onPopState = () => tracker.handleRouteChange('popstate');
  const onHashChange = () => tracker.handleRouteChange('hashchange');
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);

  // Observe DOM mutations that typically indicate a same-URL view switch:
  // class/aria changes on menu/tab items, or document.title updates.
  let inferTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleInfer = () => {
    if (inferTimer) return;
    inferTimer = setTimeout(() => {
      inferTimer = null;
      tracker.inferView();
    }, 60);
  };

  const viewObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        const name = m.attributeName;
        if (name === 'class' || name === 'aria-selected' || name === 'aria-current' || name === 'hidden') {
          scheduleInfer();
          return;
        }
      } else if (m.type === 'childList' && m.target.nodeType === Node.ELEMENT_NODE) {
        const el = m.target as Element;
        if (el.tagName === 'TITLE' || el.matches?.('.breadcrumb, .breadcrumb *')) {
          scheduleInfer();
          return;
        }
      }
    }
  });
  viewObserver.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-selected', 'aria-current', 'hidden'],
    childList: true,
  });

  // Kick off: initial pageview, then a deferred inferView to pick up the
  // first-render view label (e.g. .active panel on first paint).
  tracker.emit('pageview', { trigger: 'init' });
  setTimeout(() => tracker.inferView(), 100);

  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('hashchange', onHashChange);
    viewObserver.disconnect();
    if (inferTimer) clearTimeout(inferTimer);
  };
};
