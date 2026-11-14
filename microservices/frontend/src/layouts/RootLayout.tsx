import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatches } from 'react-router';
import { pageMeta } from '@/lib/pageMeta';

/** A route marks itself as a public page by giving its title (a translation key) in `handle`. */
export interface RouteHandle {
  title?: string;
}

function setMeta(name: string, content: string | null): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (content === null) return tag?.remove();
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.append(tag);
  }
  tag.content = content;
}

/**
 * Sets the page title and description, and asks search engines to skip every page that is not
 * a public one (the app, sign-in and language screens).
 */
export function RootLayout() {
  const { t } = useTranslation();
  const matches = useMatches();
  const title = (matches.at(-1)?.handle as RouteHandle | undefined)?.title;

  useEffect(() => {
    const meta = pageMeta(t, title);
    document.title = meta.title;
    setMeta('description', meta.description);
    setMeta('robots', title ? null : 'noindex');
  }, [title, t]);

  return <Outlet />;
}
