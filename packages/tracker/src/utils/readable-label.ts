/**
 * Best-effort human-readable label for a DOM element.
 *
 * Priority:
 * 1. aria-label / title / alt / placeholder — explicit author intent
 * 2. textContent — but ONLY if the element is "leaf-like" (no block-level children).
 *    Otherwise text from grandchildren (e.g. "供应商总数\n128\n↑12%") would pollute the label.
 * 3. value (for inputs/buttons)
 *
 * Returns trimmed string ≤100 chars, or undefined.
 */
export function readableLabel(el: Element): string | undefined {
  const aria = el.getAttribute('aria-label');
  if (aria && aria.trim()) return truncate(aria.trim());

  const title = el.getAttribute('title');
  if (title && title.trim()) return truncate(title.trim());

  const alt = el.getAttribute('alt');
  if (alt && alt.trim()) return truncate(alt.trim());

  const placeholder = el.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) return truncate(placeholder.trim());

  const value = (el as HTMLInputElement).value;
  if (typeof value === 'string' && value.trim() && (el.tagName === 'INPUT' || el.tagName === 'BUTTON')) {
    return truncate(value.trim());
  }

  // textContent — only when element is leaf-like (no block children) to avoid catching
  // aggregated card text like "供应商总数\n128\n↑12%"
  const text = leafText(el);
  if (text) return truncate(text);

  return undefined;
}

function leafText(el: Element): string {
  // Block-level children → treat as container; use only first non-empty direct text node
  // (or first leaf descendant's text). Avoids catching multi-line container content.
  const hasBlockChild = Array.from(el.children).some((c) => isBlockLike(c as HTMLElement));
  if (!hasBlockChild) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t;
  }

  // Container: find first direct text-only child element
  for (const child of Array.from(el.children)) {
    const t = leafText(child);
    if (t) return t;
  }
  return '';
}

function isBlockLike(el: HTMLElement): boolean {
  // Heuristic — don't call getComputedStyle in hot path (expensive on hundreds of impressions).
  // Just check tagName.
  const tag = el.tagName;
  return tag === 'DIV' || tag === 'P' || tag === 'SECTION' || tag === 'ARTICLE' ||
         tag === 'HEADER' || tag === 'FOOTER' || tag === 'NAV' || tag === 'ASIDE' ||
         tag === 'UL' || tag === 'OL' || tag === 'LI' || tag === 'TABLE' || tag === 'TR' ||
         tag === 'TBODY' || tag === 'THEAD' || tag === 'FORM' || tag === 'FIELDSET' ||
         tag === 'H1' || tag === 'H2' || tag === 'H3' ||
         tag === 'H4' || tag === 'H5' || tag === 'H6';
}

function truncate(s: string): string {
  return s.length > 100 ? s.slice(0, 100) : s;
}
