import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

type Spy = { __csp?: string[] };

/**
 * Every test also fails on an uncaught error or on anything the browser refuses under the page's
 * Content-Security-Policy.
 */
export const test = base.extend<{ watch: void }>({
  watch: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => {
        // WebKit reports a service worker update check that was cut short (the page closed or went
        // offline) as an error of the page. It is not one.
        if (/sw\.js.*access control checks/.test(error.message)) return;
        problems.push(`error: ${error.message}`);
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          const spy = window as unknown as Spy;
          (spy.__csp ??= []).push(`${event.violatedDirective}: ${event.blockedURI}`);
        });
      });
      await use();
      const refused = await page
        .evaluate(() => (window as unknown as Spy).__csp ?? [])
        .catch(() => []);
      expect([...problems, ...refused], 'no uncaught error, no policy violation').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** A guest who is set up, with consent given: the state after the welcome screens. */
export async function signedInGuest(page: Page, language = 'en'): Promise<void> {
  await page.goto('/design'); // any page of the site, to be able to set what the browser keeps
  await page.evaluate((lang) => {
    localStorage.clear();
    localStorage.setItem('kavach.session', '{"kind":"guest"}');
    localStorage.setItem('kavach.onboarded', '1');
    localStorage.setItem('kavach.lang', lang);
    localStorage.setItem(
      'kavach.consent',
      JSON.stringify({
        version: '2026-11-v1',
        grantedAt: new Date().toISOString(),
      }),
    );
  }, language);
}

const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

interface Violation {
  id: string;
  impact: string;
  help: string;
  nodes: { target: string[] }[];
}

/** WCAG 2.1 A and AA plus best practices, the same rules as the Edge suite. One short line each. */
export async function accessibilityProblems(page: Page): Promise<string[]> {
  await page.evaluate(AXE); // evaluated, not added as a script: the page's policy does not apply
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {
          run: (c: Document, o: object) => Promise<{ violations: Violation[] }>;
        };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    });
    return result.violations.map(
      (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')} | ${v.help}`,
    );
  });
}
