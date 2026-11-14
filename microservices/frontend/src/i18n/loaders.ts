import type { Language } from './languages';

/**
 * Only English is part of the first download. Every other language is fetched as its own small
 * file when it is first used, so a person reading Hindi does not also download Tamil and Telugu.
 */
type Messages = Record<string, unknown>;

export const LOADERS: Record<Exclude<Language, 'en'>, () => Promise<{ default: Messages }>> = {
  hi: () => import('./locales/hi.json'),
  bn: () => import('./locales/bn.json'),
  mr: () => import('./locales/mr.json'),
  ta: () => import('./locales/ta.json'),
  te: () => import('./locales/te.json'),
  gu: () => import('./locales/gu.json'),
};
