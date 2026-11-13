import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, LANGUAGE_LIST, getLanguageInfo, isLanguage } from './languages';
import bn from './locales/bn.json';
import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';

const LOCALES: Record<string, unknown> = { en, hi, bn, mr, ta, te, gu };

/** The `demo` section belongs to the internal design-system page and may be English/Hindi only. */
function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  return Object.entries(value as object).reduce<Record<string, string>>((all, [key, child]) => {
    if (!prefix && key === 'demo') return all;
    return { ...all, ...leaves(child, prefix ? `${prefix}.${key}` : key) };
  }, {});
}

const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();

describe('language registry', () => {
  it('English is the default language', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('has a locale file for every registered language', () => {
    for (const { code } of LANGUAGE_LIST) {
      expect(LOCALES[code], `missing locale for ${code}`).toBeDefined();
    }
  });

  it('recognises valid and invalid codes', () => {
    expect(isLanguage('ta')).toBe(true);
    expect(isLanguage('xx')).toBe(false);
    expect(isLanguage(null)).toBe(false);
    expect(getLanguageInfo('unknown').code).toBe('en');
  });

  it('only English is marked as the source; all others stay draft until reviewed', () => {
    const sources = LANGUAGE_LIST.filter((l) => l.reviewStatus === 'source').map((l) => l.code);
    expect(sources).toEqual(['en']);
  });
});

describe('translations', () => {
  const reference = leaves(en);

  for (const { code } of LANGUAGE_LIST) {
    describe(code, () => {
      const current = leaves(LOCALES[code]);

      it('has exactly the same keys as English', () => {
        expect(Object.keys(current).sort()).toEqual(Object.keys(reference).sort());
      });

      it('has no empty text', () => {
        for (const [key, value] of Object.entries(current)) {
          expect(value.trim(), `${code}:${key} is empty`).not.toBe('');
        }
      });

      it('keeps the same {{placeholders}} as English', () => {
        for (const [key, value] of Object.entries(current)) {
          expect(placeholders(value), `${code}:${key}`).toEqual(placeholders(reference[key]));
        }
      });
    });
  }

  it('the 1930 helpline number appears in the emergency text of every language', () => {
    for (const { code } of LANGUAGE_LIST) {
      expect(leaves(LOCALES[code])['emergency.text']).toContain('1930');
    }
  });

  it('every risk level has a label, title and message', () => {
    const levels = ['very_high', 'high', 'medium', 'cannot_verify', 'low'];
    for (const { code } of LANGUAGE_LIST) {
      const tree = leaves(LOCALES[code]);
      for (const level of levels) {
        expect(tree[`risk.label.${level}`]).toBeTruthy();
        expect(tree[`risk.title.${level}`]).toBeTruthy();
        expect(tree[`risk.message.${level}`]).toBeTruthy();
      }
    }
  });
});
