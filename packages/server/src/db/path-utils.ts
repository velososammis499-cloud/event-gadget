/**
 * Normalize legacy '#view=' to canonical '?view=' so historical and current
 * events bucket together in aggregations. Idempotent.
 *
 * Background: tracker SDK historically encoded the view label as '#view=' and
 * later switched to '?view='. Real DB samples have both formats coexisting,
 * causing the same view to be counted as two separate page_paths in any
 * aggregation that compares page_path as a string. This helper folds the
 * legacy form into the canonical one at read time, so all aggregation paths
 * see a single key per view.
 */
export function unifyViewKey(path: string | null | undefined): string {
  if (!path) return path ?? '';
  const idx = path.indexOf('#view=');
  if (idx < 0) return path;
  // Defensive: if a row somehow has both markers, leave it alone — replacing
  // would create a double '?view=' which is worse than mixed.
  if (path.slice(0, idx).includes('?view=')) return path;
  return path.slice(0, idx) + '?view=' + path.slice(idx + '#view='.length);
}
