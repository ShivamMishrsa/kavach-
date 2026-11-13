import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readStorage, writeStorage } from '@/lib/storage';
import { loadFontsFor } from './fonts';
import { DEFAULT_LANGUAGE, isLanguage, type Language } from './languages';
import bn from './locales/bn.json';
import en from './locales/en.json';
import gu from './locales/gu.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import te from './locales/te.json';

export { LANGUAGE_LIST, DEFAULT_LANGUAGE, isLanguage, getLanguageInfo } from './languages';
export type { Language } from './languages';

const LANG_KEY = 'kavach.lang';

function initialLanguage(): Language {
  const saved = readStorage(LANG_KEY);
  return isLanguage(saved) ? saved : DEFAULT_LANGUAGE;
}

const start = initialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
    mr: { translation: mr },
    ta: { translation: ta },
    te: { translation: te },
    gu: { translation: gu },
  },
  lng: start,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function apply(language: string): void {
  document.documentElement.lang = language;
  if (isLanguage(language)) void loadFontsFor(language);
}

apply(start);
i18n.on('languageChanged', (language) => {
  apply(language);
  writeStorage(LANG_KEY, language);
});

export default i18n;
