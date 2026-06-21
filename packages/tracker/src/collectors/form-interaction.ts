import type { CollectorInit } from '../types';
import { extractFieldMetadata, shouldSkipFieldTracking } from '../utils/sensitive-fields';

export const initFormInteractionCollector: CollectorInit = (tracker) => {
  function getFormInfo(el: HTMLElement): { formId?: string; formAction?: string } {
    const form = el.closest('form');
    return {
      formId: form?.id || undefined,
      formAction: form?.action || undefined,
    };
  }

  // Debounce per (formId + field + action) to avoid multi-form cross-contamination
  const emitCache = new Map<string, number>();
  const DEBOUNCE_MS = 300;
  const MAX_CACHE_SIZE = 200;

  function shouldEmit(key: string): boolean {
    const now = Date.now();
    const last = emitCache.get(key);
    if (last !== undefined && now - last < DEBOUNCE_MS) return false;
    emitCache.set(key, now);
    // Prevent memory leak on long-lived pages with many fields
    if (emitCache.size > MAX_CACHE_SIZE) {
      const oldest = [...emitCache.entries()].sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < oldest.length / 2; i++) emitCache.delete(oldest[i][0]);
    }
    return true;
  }

  function onFocus(e: FocusEvent): void {
    const target = e.target as HTMLElement;
    if (!target || !target.matches) return;
    if (!target.matches('input,select,textarea')) return;
    if (target.isContentEditable) return;

    const meta = extractFieldMetadata(target);
    if (shouldSkipFieldTracking(meta)) return;

    const { formId, formAction } = getFormInfo(target);
    const key = `focus:${formId || ''}:${meta.id || meta.name}`;
    if (!shouldEmit(key)) return;

    tracker.emit('form_interaction', {
      action: 'focus',
      formId,
      formAction,
      fieldName: meta.name || undefined,
      fieldType: meta.type || undefined,
      fieldId: meta.id || undefined,
    });
  }

  function onChange(e: Event): void {
    const target = e.target as HTMLElement;
    if (!target || !target.matches) return;
    if (!target.matches('input,select,textarea')) return;
    if (target.isContentEditable) return;

    const meta = extractFieldMetadata(target);
    if (shouldSkipFieldTracking(meta)) return;

    const { formId, formAction } = getFormInfo(target);
    const key = `change:${formId || ''}:${meta.id || meta.name}`;
    if (!shouldEmit(key)) return;

    tracker.emit('form_interaction', {
      action: 'change',
      formId,
      formAction,
      fieldName: meta.name || undefined,
      fieldType: meta.type || undefined,
      fieldId: meta.id || undefined,
    });
  }

  function onSubmit(e: Event): void {
    const form = e.target as HTMLFormElement;
    if (!form || form.tagName !== 'FORM') return;

    tracker.emit('form_interaction', {
      action: 'submit',
      formId: form.id || undefined,
      formAction: form.action || undefined,
    });
  }

  document.addEventListener('focus', onFocus, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('submit', onSubmit, true);

  return () => {
    document.removeEventListener('focus', onFocus, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('submit', onSubmit, true);
    emitCache.clear();
  };
};
