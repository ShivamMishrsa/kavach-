import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readStorage, writeStorage } from '@/lib/storage';
import { loadFontsFor } from './fonts';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './languages';
import { LOADERS } from './loaders';
import en from './locales/en.json';

export { LANGUAGE_LIST, DEFAULT_LANGUAGE, isLanguage, getLanguageInfo } from './languages';
export type { Language } from './languages';

/** Also read by scripts/skip-prerender.js, which runs before this code. */
export const LANG_KEY = 'kavach.lang';

function initialLanguage(): Language {
  const saved = readStorage(LANG_KEY);
  return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
}

const start = initialLanguage();

void i18n.use(initReactI18next).init({
  // English is always there: it is the fallback for anything not yet loaded or not translated.
  resources: { en: { translation: en } },
  lng: start,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/** Fetches a language the first time it is needed. A failure leaves the English text showing. */
async function loadLanguage(language: Language): Promise<void> {
  if (language === 'en' || i18n.hasResourceBundle(language, 'translation')) return;
  const messages = await LOADERS[language]();
  i18n.addResourceBundle(language, 'translation', messages.default);
}

/** Switches the language once its text has arrived, so the screen never flashes English. */
export async function setLanguage(language: string): Promise<void> {
  if (!isLanguage(language)) return;
  await loadLanguage(language).catch(() => undefined);
  await i18n.changeLanguage(language);
}

/** Resolves when the language chosen on an earlier visit is ready to draw. */
export const ready: Promise<void> = loadLanguage(start).catch(() => undefined);

function apply(language: string): void {
  document.documentElement.lang = language;
  if (isLanguage(language)) void loadFontsFor(language);
}

if (typeof document !== 'undefined') apply(start);
i18n.on('languageChanged', (language) => {
  apply(language);
  writeStorage(LANG_KEY, language);
});

export default i18n;
