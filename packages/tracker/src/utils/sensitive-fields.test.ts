import { describe, it, expect } from 'vitest';
import { shouldSkipFieldTracking, extractFieldMetadata, compileMatchers } from './sensitive-fields';
import type { FieldMetadataV1 } from './sensitive-fields';

function makeMeta(overrides: Partial<FieldMetadataV1> = {}): FieldMetadataV1 {
  return {
    name: '',
    id: '',
    type: '',
    autocompleteTokens: new Set(),
    dataSensitive: false,
    ...overrides,
  };
}

describe('shouldSkipFieldTracking', () => {
  it('blocks type=password (hard block)', () => {
    expect(shouldSkipFieldTracking(makeMeta({ type: 'password' }))).toBe(true);
  });

  it('blocks autocomplete cc-number', () => {
    expect(shouldSkipFieldTracking(makeMeta({ autocompleteTokens: new Set(['cc-number']) }))).toBe(true);
  });

  it('blocks autocomplete current-password', () => {
    expect(shouldSkipFieldTracking(makeMeta({ autocompleteTokens: new Set(['current-password']) }))).toBe(true);
  });

  it('blocks name containing password via regex', () => {
    expect(shouldSkipFieldTracking(makeMeta({ name: 'user_password' }))).toBe(true);
  });

  it('blocks name containing token via regex', () => {
    expect(shouldSkipFieldTracking(makeMeta({ name: 'csrf_token' }))).toBe(true);
  });

  it('does NOT block "discard" (card false positive)', () => {
    expect(shouldSkipFieldTracking(makeMeta({ name: 'discard' }))).toBe(false);
  });

  it('may block "tokenize" (token match is intentionally broad)', () => {
    // /token/i without word boundary — trade-off: token fields are universally
    // sensitive, accept false positive on "tokenize" to catch csrf_token etc.
    expect(shouldSkipFieldTracking(makeMeta({ name: 'tokenize' }))).toBe(true);
  });

  it('blocks data-sensitive="true"', () => {
    expect(shouldSkipFieldTracking(makeMeta({ dataSensitive: true }))).toBe(true);
  });

  it('allows normal field', () => {
    expect(shouldSkipFieldTracking(makeMeta({ name: 'email', type: 'text' }))).toBe(false);
  });
});

describe('extractFieldMetadata', () => {
  it('extracts and lowercases attributes', () => {
    const el = document.createElement('input');
    el.id = 'EmailField';
    (el as HTMLInputElement).name = 'UserEmail';
    (el as HTMLInputElement).type = 'TEXT';
    el.setAttribute('autocomplete', 'email');

    const meta = extractFieldMetadata(el);
    expect(meta.id).toBe('emailfield');
    expect(meta.name).toBe('useremail');
    expect(meta.type).toBe('text');
    expect(meta.autocompleteTokens.has('email')).toBe(true);
  });

  it('splits multi-token autocomplete', () => {
    const el = document.createElement('input');
    el.setAttribute('autocomplete', 'section-red shipping cc-number');

    const meta = extractFieldMetadata(el);
    expect(meta.autocompleteTokens.has('cc-number')).toBe(true);
    expect(meta.autocompleteTokens.has('shipping')).toBe(true);
  });

  it('recognizes data-sensitive="true"', () => {
    const el = document.createElement('input');
    el.setAttribute('data-sensitive', 'true');
    expect(extractFieldMetadata(el).dataSensitive).toBe(true);
  });

  it('recognizes data-sensitive="1"', () => {
    const el = document.createElement('input');
    el.setAttribute('data-sensitive', '1');
    expect(extractFieldMetadata(el).dataSensitive).toBe(true);
  });

  it('recognizes data-sensitive="yes"', () => {
    const el = document.createElement('input');
    el.setAttribute('data-sensitive', 'yes');
    expect(extractFieldMetadata(el).dataSensitive).toBe(true);
  });

  it('recognizes bare data-sensitive attribute', () => {
    const el = document.createElement('input');
    el.setAttribute('data-sensitive', '');
    expect(extractFieldMetadata(el).dataSensitive).toBe(true);
  });

  it('rejects data-sensitive="false"', () => {
    const el = document.createElement('input');
    el.setAttribute('data-sensitive', 'false');
    expect(extractFieldMetadata(el).dataSensitive).toBe(false);
  });

  it('does NOT extract dataset (privacy)', () => {
    const el = document.createElement('input');
    el.dataset.customInfo = 'secret';
    const meta = extractFieldMetadata(el);
    expect((meta as any).dataset).toBeUndefined();
  });

  it('rejects global regex patterns', () => {
    expect(() => compileMatchers([/password/g])).toThrow();
  });

  it('rejects sticky regex patterns', () => {
    expect(() => compileMatchers([/password/y])).toThrow();
  });

  it('normalizes autocomplete tokens to lowercase', () => {
    const el = document.createElement('input');
    el.setAttribute('autocomplete', 'CC-NUMBER');
    const meta = extractFieldMetadata(el);
    expect(meta.autocompleteTokens.has('cc-number')).toBe(true);
  });

  it('fuzz: random field names never throw or produce inconsistent results', () => {
    const randomNames = Array.from({ length: 100 }, () =>
      Math.random().toString(36).slice(2, 10)
    );
    for (const name of randomNames) {
      const meta = makeMeta({ name });
      const r1 = shouldSkipFieldTracking(meta);
      const r2 = shouldSkipFieldTracking(meta);
      // Must not throw and must be deterministic
      expect(typeof r1).toBe('boolean');
      expect(r1).toBe(r2);
    }
  });
});
