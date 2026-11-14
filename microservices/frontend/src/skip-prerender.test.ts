import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LANG_KEY } from './i18n';
import { STORAGE_KEY } from './theme/ThemeProvider';

const script = readFileSync(new URL('../scripts/skip-prerender.js', import.meta.url), 'utf8');

/** Runs the script the way a browser would, with the given saved choices, and says if it hid the page. */
function hides(options: { path?: string; saved?: Record<string, string>; broken?: boolean }) {
  const attributes: Record<string, string> = {};
  const html = {
    dataset: { prerendered: '/privacy' },
    setAttribute: (name: string, value: string) => (attributes[name] = value),
  };
  const storage = {
    getItem: (key: string) => {
      if (options.broken) throw new Error('blocked');
      return options.saved?.[key] ?? null;
    },
  };
  const location = { pathname: options.path ?? '/privacy' };
  new Function('document', 'localStorage', 'location', script)(
    { documentElement: html },
    storage,
    location,
  );
  return 'data-skip-prerender' in attributes;
}

describe('hiding the written-out page from someone who would see something else', () => {
  it('shows it to a first-time visitor', () => {
    expect(hides({})).toBe(false);
    expect(hides({ path: '/privacy/' })).toBe(false);
  });

  it('shows it when the saved choices are the ones it was written for', () => {
    const saved = {
      [LANG_KEY]: 'en',
      [STORAGE_KEY]: JSON.stringify({ theme: 'light', text: 'normal' }),
    };
    expect(hides({ saved })).toBe(false);
  });

  it('hides it for another language, dark colours, larger text or high contrast', () => {
    expect(hides({ saved: { [LANG_KEY]: 'hi' } })).toBe(true);
    expect(hides({ saved: { [STORAGE_KEY]: JSON.stringify({ theme: 'dark' }) } })).toBe(true);
    expect(hides({ saved: { [STORAGE_KEY]: JSON.stringify({ text: 'large' }) } })).toBe(true);
    expect(hides({ saved: { [STORAGE_KEY]: JSON.stringify({ highContrast: true }) } })).toBe(true);
  });

  it('hides it on any other address (the server answers every address with the landing page)', () => {
    expect(hides({ path: '/app' })).toBe(true);
    expect(hides({ path: '/' })).toBe(true);
  });

  it('does not break the page when the browser will not give out saved data', () => {
    expect(hides({ broken: true })).toBe(false);
  });

  it('is what the Content-Security-Policy names, byte for byte', () => {
    // vite.config.ts hashes the trimmed file; the build puts the same text in each page.
    expect(script.trim()).toBe(script.replace(/\s+$/, ''));
    expect(createHash('sha256').update(script.trim()).digest('base64')).toMatch(
      /^[A-Za-z0-9+/]{43}=$/,
    );
  });
});
