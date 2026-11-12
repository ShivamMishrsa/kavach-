import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { readStorage, writeStorage } from '@/lib/storage';
import en from './locales/en.json';
import hi from './locales/hi.json';

export const LANGUAGES = ['hi', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const LANG_KEY = 'kavach.lang';

function initialLanguage(): Language {
  const saved = readStorage(LANG_KEY);
  return saved === 'en' || saved === 'hi' ? saved : 'hi'; // Hindi first
}

void i18n.use(initReactI18next).init({
  resources: { hi: { translation: hi }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function syncDocumentLang(lang: string): void {
  document.documentElement.lang = lang;
}

syncDocumentLang(i18n.language);
i18n.on('languageChanged', (lang) => {
  syncDocumentLang(lang);
  writeStorage(LANG_KEY, lang);
});

export default i18n;
