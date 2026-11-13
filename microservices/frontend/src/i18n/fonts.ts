import type { Language } from './languages';

/**
 * Script fonts are loaded only when that language is used, so English users do not
 * download Indic fonts. Fonts are self-hosted (Fontsource); nothing comes from a CDN.
 */
const devanagari = () =>
  Promise.all([
    import('@fontsource/noto-sans-devanagari/400.css'),
    import('@fontsource/noto-sans-devanagari/700.css'),
    import('@fontsource/noto-sans-devanagari/800.css'),
  ]);

const FONT_LOADERS: Partial<Record<Language, () => Promise<unknown>>> = {
  hi: devanagari,
  mr: devanagari,
  bn: () =>
    Promise.all([
      import('@fontsource/noto-sans-bengali/400.css'),
      import('@fontsource/noto-sans-bengali/700.css'),
      import('@fontsource/noto-sans-bengali/800.css'),
    ]),
  ta: () =>
    Promise.all([
      import('@fontsource/noto-sans-tamil/400.css'),
      import('@fontsource/noto-sans-tamil/700.css'),
      import('@fontsource/noto-sans-tamil/800.css'),
    ]),
  te: () =>
    Promise.all([
      import('@fontsource/noto-sans-telugu/400.css'),
      import('@fontsource/noto-sans-telugu/700.css'),
      import('@fontsource/noto-sans-telugu/800.css'),
    ]),
  gu: () =>
    Promise.all([
      import('@fontsource/noto-sans-gujarati/400.css'),
      import('@fontsource/noto-sans-gujarati/700.css'),
      import('@fontsource/noto-sans-gujarati/800.css'),
    ]),
};

const loaded = new Set<Language>();

export async function loadFontsFor(language: Language): Promise<void> {
  const loader = FONT_LOADERS[language];
  if (!loader || loaded.has(language)) return;
  loaded.add(language);
  try {
    await loader();
  } catch {
    loaded.delete(language); // fall back to system fonts; try again next time
  }
}
