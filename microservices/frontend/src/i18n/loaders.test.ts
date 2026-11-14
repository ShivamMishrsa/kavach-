import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import { LANGUAGE_LIST } from './languages';
import { LOADERS } from './loaders';

describe('language loaders', () => {
  it('has a loader for every language except English, which is always bundled', () => {
    const others = LANGUAGE_LIST.map((language) => language.code).filter((code) => code !== 'en');
    expect(Object.keys(LOADERS).sort()).toEqual(others.sort());
  });

  it("each loader returns that language's messages with the same sections as English", async () => {
    for (const [code, load] of Object.entries(LOADERS)) {
      const messages = (await load()).default;
      // `demo` belongs to the internal design-system page and is English and Hindi only.
      const sections = Object.keys(en).filter((section) => section !== 'demo');
      expect(
        Object.keys(messages)
          .filter((s) => s !== 'demo')
          .sort(),
        code,
      ).toEqual(sections.sort());
    }
  });
});
