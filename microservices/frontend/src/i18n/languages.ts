/**
 * Supported UI languages. Adding a language = add a locale file, one entry here,
 * and a font loader in fonts.ts. The translation tests then check it automatically.
 *
 * reviewStatus: 'source' = written in the product language; 'draft' = translation not yet
 * reviewed by a native speaker. Do not treat a 'draft' language as production-ready.
 * scanSupport: whether notice scanning (OCR + rules) is planned to work well in that language.
 */
export interface LanguageInfo {
  code: string;
  nativeName: string;
  englishName: string;
  reviewStatus: 'source' | 'draft';
  scanSupport: 'full' | 'limited';
}

export const LANGUAGE_LIST = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    reviewStatus: 'source',
    scanSupport: 'full',
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    reviewStatus: 'draft',
    scanSupport: 'full',
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    reviewStatus: 'draft',
    scanSupport: 'limited',
  },
  {
    code: 'mr',
    nativeName: 'मराठी',
    englishName: 'Marathi',
    reviewStatus: 'draft',
    scanSupport: 'limited',
  },
  {
    code: 'ta',
    nativeName: 'தமிழ்',
    englishName: 'Tamil',
    reviewStatus: 'draft',
    scanSupport: 'limited',
  },
  {
    code: 'te',
    nativeName: 'తెలుగు',
    englishName: 'Telugu',
    reviewStatus: 'draft',
    scanSupport: 'limited',
  },
  {
    code: 'gu',
    nativeName: 'ગુજરાતી',
    englishName: 'Gujarati',
    reviewStatus: 'draft',
    scanSupport: 'limited',
  },
] as const satisfies readonly LanguageInfo[];

export type Language = (typeof LANGUAGE_LIST)[number]['code'];

/** English opens first; the user picks a language after sign up / log in / continue as guest. */
export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGE_LIST.some((language) => language.code === value);
}

export function getLanguageInfo(code: string): LanguageInfo {
  return LANGUAGE_LIST.find((language) => language.code === code) ?? LANGUAGE_LIST[0];
}
