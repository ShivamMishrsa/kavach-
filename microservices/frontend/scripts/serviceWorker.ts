import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Rollup } from 'vite';

/** Files of the site that are not part of the bundle but belong on the phone. */
const FIXED_FILES = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

/**
 * What the service worker saves when it is installed: the app, English, and the public pages.
 * Not saved up front, because most people never use them: the other languages, the fonts for other
 * scripts, and the Latin variants other than Latin itself. The worker saves those the first time
 * they are used, so a Hindi reader can also work offline after one visit.
 */
export function precacheList(bundle: Rollup.OutputBundle, publicPaths: string[]): string[] {
  const files = Object.values(bundle).flatMap((item) => {
    if (item.type === 'chunk') {
      const isOtherLanguage = /\/i18n\/locales\/(?!en\.json)/.test(item.facadeModuleId ?? '');
      return isOtherLanguage ? [] : [item.fileName];
    }
    const isAppStyle = item.fileName.endsWith('.css') && !/^assets\/\d+-/.test(item.fileName);
    const isLatinFont = /inter-latin-(400|700)-normal-[\w-]+\.woff2$/.test(item.fileName);
    return isAppStyle || isLatinFont ? [item.fileName] : [];
  });
  return [...publicPaths, ...FIXED_FILES, ...files.map((file) => `/${file}`)];
}

/** The service worker file, with the list and a version filled into the template. */
export function serviceWorkerSource(precache: string[], root: string): string {
  const template = readFileSync(path.join(root, 'scripts/sw.template.js'), 'utf8');
  // The files have names that change with their content, but the public pages are written out
  // after this step, so the version also changes with every build: a new build is a new worker.
  const version = createHash('sha256')
    .update(precache.join('\n'))
    .update(String(Date.now()))
    .digest('hex')
    .slice(0, 12);
  return template
    .replace('__VERSION__', version)
    .replace('__PRECACHE__', JSON.stringify(precache, null, 2));
}
