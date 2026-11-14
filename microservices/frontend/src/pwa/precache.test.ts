import { readFileSync } from 'node:fs';
import type { Rollup } from 'vite';
import { describe, expect, it } from 'vitest';
import { precacheList, serviceWorkerSource } from '../../scripts/serviceWorker';
import { PUBLIC_PATHS } from '../publicPages';

const chunk = (fileName: string, facadeModuleId: string | null = null) =>
  ({ type: 'chunk', fileName, facadeModuleId }) as unknown as Rollup.OutputChunk;
const asset = (fileName: string) => ({ type: 'asset', fileName }) as unknown as Rollup.OutputAsset;

const BUNDLE: Rollup.OutputBundle = Object.fromEntries(
  [
    chunk('assets/index-A1.js'),
    chunk('assets/Home-B2.js', '/src/pages/Home.tsx'),
    chunk('assets/hi-C3.js', '/src/i18n/locales/hi.json'),
    chunk('assets/ta-D4.js', '/src/i18n/locales/ta.json'),
    asset('assets/index-E5.css'),
    asset('assets/400-F6.css'), // the Devanagari font styles, loaded only in Hindi
    asset('assets/inter-latin-400-normal-G7.woff2'),
    asset('assets/inter-greek-400-normal-H8.woff2'),
    asset('assets/inter-latin-400-normal-G7.woff'),
  ].map((item) => [item.fileName, item]),
);

describe('what the service worker keeps on the phone', () => {
  const list = precacheList(BUNDLE, PUBLIC_PATHS);

  it('keeps the app, English, the styles, the Latin fonts and every public page', () => {
    expect(list).toContain('/assets/index-A1.js');
    expect(list).toContain('/assets/Home-B2.js');
    expect(list).toContain('/assets/index-E5.css');
    expect(list).toContain('/assets/inter-latin-400-normal-G7.woff2');
    for (const page of PUBLIC_PATHS) expect(list).toContain(page);
    expect(list).toContain('/manifest.webmanifest');
    expect(list).toContain('/icons/icon-192.png');
  });

  it('leaves other languages and other scripts to be kept when first used', () => {
    expect(list).not.toContain('/assets/hi-C3.js');
    expect(list).not.toContain('/assets/ta-D4.js');
    expect(list).not.toContain('/assets/400-F6.css');
    expect(list).not.toContain('/assets/inter-greek-400-normal-H8.woff2');
    expect(list).not.toContain('/assets/inter-latin-400-normal-G7.woff');
  });

  it('is written into the worker with a version, and nothing is left to fill in', () => {
    const source = serviceWorkerSource(list, process.cwd());
    expect(source).not.toContain('__VERSION__');
    expect(source).not.toContain('__PRECACHE__');
    expect(source).toMatch(/const VERSION = '[0-9a-f]{12}'/);
    expect(source).toContain('"/assets/index-A1.js"');
  });

  it('is a different version for a different build', () => {
    const first = serviceWorkerSource(list, process.cwd()).match(/VERSION = '(\w+)'/)?.[1];
    const second = serviceWorkerSource([...list, '/assets/new-Z9.js'], process.cwd()).match(
      /VERSION = '(\w+)'/,
    )?.[1];
    expect(first).not.toBe(second);
  });
});

describe('the worker never touches the API or private data', () => {
  const source = readFileSync(new URL('../../scripts/sw.template.js', import.meta.url), 'utf8');

  it('only handles GET requests to its own site', () => {
    expect(source).toContain("request.method !== 'GET' || url.origin !== self.location.origin");
  });

  it('keeps nothing but plain successful answers from this site', () => {
    expect(source).toContain("response.ok && response.type === 'basic'");
  });

  it('does not use background sync or push, so nothing is sent while the app is closed', () => {
    expect(source).not.toMatch(/addEventListener\('(sync|periodicsync|push)'/i);
  });
});
