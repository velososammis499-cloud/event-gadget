import type { QueryParamValue } from './client';

/**
 * Normalize query params for deterministic cache keys.
 *
 * Why this exists despite React Query's structural hashing:
 *
 * 1. React Query performs structural hashing, which may treat
 *    `{ appId: 'x', startTime: undefined }` and `{ appId: 'x' }` as
 *    different keys depending on implementation. Normalizing makes
 *    intent explicit and guarantees consistent key shape.
 *
 * 2. queryClient.getQueryData() and invalidateQueries() can match by exact key
 *    OR by prefix. Raw params with `{ appId: 'x', startTime: undefined }` vs
 *    `{ appId: 'x' }` are different objects — prefix matching works, but exact
 *    matching fails. Normalized params make exact matching reliable.
 *
 * 3. Invalidation precision: after normalizing, `invalidateQueries({ queryKey:
 *    ['pages', 'list', { appId: 'x' }] })` will match all page queries for
 *    appId='x' regardless of whether the original params had undefined startTime.
 *    Without normalization, exact-match invalidation could silently miss queries.
 *
 * 4. Debugging: React Query DevTools display raw key objects. Normalized params
 *    are predictable and readable.
 */
export function normalizeQueryParams<
  T extends Record<string, QueryParamValue>,
>(params: T): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const sortedKeys = Object.keys(params).sort();

  for (const key of sortedKeys) {
    const value = params[key];
    if (value === undefined) continue;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
      continue;
    }

    const msg =
      `[normalizeQueryParams] Invalid param "${key}": got ${typeof value}. ` +
      'Only string, number, boolean, and undefined are allowed in query params.';

    if (import.meta.env.DEV) {
      throw new Error(msg);
    }
    console.warn(msg);
    continue;
  }

  return result;
}
