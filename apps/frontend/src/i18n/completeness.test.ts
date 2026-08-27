import { describe, it, expect } from 'vitest';
import en from './en';
import ar from './ar';

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

function collectStringLeaves(obj: unknown, prefix = ''): Array<{ path: string; value: string }> {
  if (typeof obj === 'string') return [{ path: prefix, value: obj }];
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectStringLeaves(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translation completeness (en vs ar)', () => {
  it('has an identical set of key paths in both dictionaries', () => {
    const enPaths = collectKeyPaths(en).sort();
    const arPaths = collectKeyPaths(ar).sort();
    expect(arPaths).toEqual(enPaths);
  });

  it('has no empty string values in either dictionary', () => {
    const enEmpty = collectStringLeaves(en).filter((l) => l.value.trim() === '');
    const arEmpty = collectStringLeaves(ar).filter((l) => l.value.trim() === '');
    expect(enEmpty).toEqual([]);
    expect(arEmpty).toEqual([]);
  });

  it('has distinct Arabic text for the vast majority of keys (not left in English)', () => {
    const enLeaves = collectStringLeaves(en);
    const arLeaves = collectStringLeaves(ar);
    const arByPath = new Map(arLeaves.map((l) => [l.path, l.value]));

    // A handful of keys are legitimately identical across locales (e.g. brand
    // names, currency codes, technical identifiers) — allow a small tolerance
    // rather than hardcoding an exhaustive exception list here.
    const identical = enLeaves.filter((l) => arByPath.get(l.path) === l.value);
    const ratio = identical.length / enLeaves.length;
    expect(ratio).toBeLessThan(0.1);
  });

  it('interpolation placeholders match between en and ar for the same key', () => {
    const placeholderRe = /\{(\w+)\}/g;
    const enLeaves = collectStringLeaves(en);
    const arByPath = new Map(collectStringLeaves(ar).map((l) => [l.path, l.value]));

    // units.*.one is a documented exception: Arabic phrases the singular
    // count idiomatically ("خطوة واحدة" — "one step") without interpolating
    // {count}, which pluralize()'s no-op .replace() handles safely.
    const isExemptSingularUnit = (path: string) => /^units\.\w+\.one$/.test(path);

    const mismatches: string[] = [];
    for (const { path, value } of enLeaves) {
      if (isExemptSingularUnit(path)) continue;
      const enPlaceholders = [...value.matchAll(placeholderRe)].map((m) => m[1]).sort();
      if (enPlaceholders.length === 0) continue;
      const arValue = arByPath.get(path) ?? '';
      const arPlaceholders = [...arValue.matchAll(placeholderRe)].map((m) => m[1]).sort();
      if (JSON.stringify(enPlaceholders) !== JSON.stringify(arPlaceholders)) {
        mismatches.push(path);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
