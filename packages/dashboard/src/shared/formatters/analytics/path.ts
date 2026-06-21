/**
 * Decode a page_path for display in the UI.
 *
 * Server stores paths with the view label URL-encoded (e.g. /a.html?view=%E5%B7%A5%E4%BD%9C%E5%8F%B0).
 * For Chinese / non-ASCII labels this looks like gibberish in tables and charts.
 * This helper decodes the view suffix and renders a friendlier "/a.html › 工作台" form.
 *
 * Recognises both the current "?view=" delimiter and the legacy "#view=" form
 * so historical data still renders correctly.
 *
 * Decode failures (malformed escapes) fall back to the raw path.
 */
export function displayPath(rawPath: string): string {
  if (!rawPath) return rawPath;
  for (const marker of ['?view=', '#view=']) {
    const idx = rawPath.indexOf(marker);
    if (idx >= 0) {
      const base = rawPath.slice(0, idx);
      const encoded = rawPath.slice(idx + marker.length);
      return `${safeDecode(base)} › ${safeDecode(encoded)}`;
    }
  }
  return safeDecode(rawPath);
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
