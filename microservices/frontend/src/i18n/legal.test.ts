import { describe, expect, it } from 'vitest';
import en from './legal/en.json';
import hi from './legal/hi.json';

/** The legal pages exist in English and Hindi and must say the same things in both. */
const DOCS = ['privacy', 'terms', 'limitations'] as const;

describe('legal pages', () => {
  it('has the same documents, sections and paragraphs in English and Hindi', () => {
    for (const doc of DOCS) {
      const shape = (text: typeof en) => text[doc].sections.map((section) => section.p.length);
      expect(shape(hi), doc).toEqual(shape(en));
    }
  });

  it('has no empty text', () => {
    for (const text of [en, hi]) {
      expect(text.draft.trim()).not.toBe('');
      for (const doc of DOCS) {
        expect(text[doc].title.trim()).not.toBe('');
        for (const { h, p } of text[doc].sections) {
          expect(h.trim()).not.toBe('');
          for (const line of p) expect(line.trim()).not.toBe('');
        }
      }
    }
  });

  it('does not promise an accuracy figure or "100%" certainty', () => {
    const claims = /\d+\s?%\s?(accura|सटीक)|guarantee[sd]? (accura|to be)/i;
    for (const text of [en, hi]) expect(JSON.stringify(text)).not.toMatch(claims);
  });
});
