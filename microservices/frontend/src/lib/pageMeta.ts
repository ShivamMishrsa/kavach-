import type { TFunction } from 'i18next';

/** What goes in the head of a page: its title (a public page names itself), and its summary. */
export function pageMeta(t: TFunction, title: string | undefined) {
  return {
    title: title ? `${t(title)} · ${t('app.name')}` : t('app.name'),
    description: t('welcome.subtitle'),
  };
}
