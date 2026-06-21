/**
 * tracking-policy.ts (planned rename) — privacy boundary filter.
 *
 * This is the "pre-emit filter layer". Any collector that handles form fields
 * MUST pass through this layer before emitting. It enforces:
 * - Hard block on password/payment/secret fields
 * - Regex-based pattern matching with boundary protection
 * - Autocomplete attribute inspection
 * - data-sensitive attribute support
 * - Compile-time validation (no global/sticky regex)
 * - Runtime mutation prevention (Object.freeze)
 *
 * Design decisions:
 * - Compile phase: autocomplete tokens are pre-compiled into a Set at init time,
 *   regex matchers are validated once. Hot path (shouldSkipFieldTracking) does
 *   zero allocation — no split, no lowercase, no regex construction.
 * - Hard block: type=password, data-sensitive, autocomplete tokens —
 *   never rely on regex for these.
 * - Regex patterns use word boundaries (\b) to avoid false positives
 *   (e.g. "discard" should not match "card", "tokenize" should not match "token").
 * - All DOM attributes are lowercased once at extraction time.
 * - autocomplete supports multi-token: "section-red shipping cc-number"
 * - contenteditable is NOT handled here — collector-level concern.
 * - File planned rename: tracking-policy.ts (not just a utility anymore).
 *
 * Boundary conditions:
 * - el with no name/type/id: only autocomplete, type=password, data-sensitive are checked
 * - global/sticky regex: rejected at compile time (RegExp state bug prevention)
 */

// ===== Matcher — regex only (exact removed: was never implemented) =====
export type SensitiveMatcher = {
  pattern: RegExp;
};

// ===== Compile phase =====

const RAW_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /\bpwd\b/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /\bcvv\b/i,
  /\bcvc\b/i,
  /\botp\b/i,
  /\bssn\b/i,
  /\bsecret\b/i,
  /token/i,
];

// Validate: reject global/sticky regex (causes RegExp state bugs with .test())
export function compileMatchers(raw: RegExp[]): SensitiveMatcher[] {
  return raw.map((re) => {
    if (re.global || re.sticky) {
      throw new Error(`[SG TrackingPolicy] Invalid regex /${re.source}/${re.flags}: global/sticky not allowed`);
    }
    return { pattern: re };
  });
}

export const SENSITIVE_PATTERNS: readonly SensitiveMatcher[] = Object.freeze(compileMatchers(RAW_PATTERNS));

// Pre-compile autocomplete tokens into a Set for O(1) lookup
const RAW_AUTOCOMPLETE = [
  'current-password',
  'new-password',
  'cc-number',
  'cc-csc',
  'cc-exp',
  'cc-type',
];

export const SENSITIVE_AUTOCOMPLETE: Set<string> = Object.freeze(new Set(RAW_AUTOCOMPLETE));

// ===== Field metadata (versioned for schema evolution) =====
export type FieldMetadataV1 = {
  name: string;
  id: string;
  type: string;
  autocompleteTokens: Set<string>;
  dataSensitive: boolean;
};

// Truthy values for data-sensitive attribute: "true", "1", "yes", or bare attribute
const DATA_SENSITIVE_VALUES = new Set(['true', '1', 'yes', '']);

export function extractFieldMetadata(el: HTMLElement): FieldMetadataV1 {
  const attr = el.getAttribute('data-sensitive');
  // Split autocomplete on whitespace for multi-token support
  const acRaw = (el.getAttribute('autocomplete') || '').toLowerCase();
  const autocompleteTokens = new Set(acRaw.split(/\s+/).filter(Boolean));
  return {
    name: ((el as HTMLInputElement).name || '').toLowerCase(),
    id: (el.id || '').toLowerCase(),
    type: ((el as HTMLInputElement).type || '').toLowerCase(),
    autocompleteTokens,
    dataSensitive: attr !== null && DATA_SENSITIVE_VALUES.has(attr.toLowerCase()),
  };
}

// ===== Core check — optimized hot path =====
// Constraints (do not introduce in this function):
// - No dynamic regex construction
// - No Object.keys / Object.values
// - No JSON.stringify
// - No dataset iteration
// - No split/lowercase (done once at extraction time)
// Reason: called on every focus/change DOM event, must be minimal cost
export function shouldSkipFieldTracking(meta: FieldMetadataV1): boolean {
  // Hard block: data-sensitive
  if (meta.dataSensitive) return true;

  // Hard block: type=password
  if (meta.type === 'password') return true;

  // Hard block: autocomplete contains sensitive token
  for (const token of meta.autocompleteTokens) {
    if (SENSITIVE_AUTOCOMPLETE.has(token)) return true;
  }

  // Regex check on name, type, id
  for (const matcher of SENSITIVE_PATTERNS) {
    if (matcher.pattern.test(meta.name) || matcher.pattern.test(meta.type) || matcher.pattern.test(meta.id)) {
      return true;
    }
  }

  return false;
}

// ===== Event-level drop check (for click/impression) =====
// Used by collectors that don't handle a specific field but may pick up sensitive
// content via readableLabel reading .value, or by being inside a password form.
// Returns true if the entire event should be dropped (not just its text field).
export function shouldDropEvent(el: Element): boolean {
  if (el instanceof HTMLElement && shouldSkipFieldTracking(extractFieldMetadata(el))) {
    return true;
  }
  // Element sits inside a form that contains a password / sensitive autocomplete field —
  // the surrounding submit button or any sibling label may leak adjacent values.
  const form = el.closest && el.closest('form');
  if (form) {
    if (form.querySelector('input[type="password"]')) return true;
    if (form.querySelector('input[autocomplete*="password"], input[autocomplete*="cc-number"], input[autocomplete*="cc-csc"]')) {
      return true;
    }
  }
  return false;
}
