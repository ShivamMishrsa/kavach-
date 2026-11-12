import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import hi from './locales/hi.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translations', () => {
  it('Hindi and English have exactly the same keys', () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
  });

  it('no translation is empty', () => {
    const empty = (tree: unknown): boolean =>
      typeof tree === 'string'
        ? tree.trim() === ''
        : Object.values(tree as object).some((child) => empty(child));
    expect(empty(hi)).toBe(false);
    expect(empty(en)).toBe(false);
  });

  it('every risk level has a label, title and message in both languages', () => {
    for (const lang of [hi, en]) {
      for (const level of ['very_high', 'high', 'medium', 'cannot_verify', 'low']) {
        expect(lang.risk.label).toHaveProperty(level);
        expect(lang.risk.title).toHaveProperty(level);
        expect(lang.risk.message).toHaveProperty(level);
      }
    }
  });
});
