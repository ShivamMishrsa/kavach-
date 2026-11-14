import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

const locale = (code: string) =>
  JSON.parse(readFileSync(new URL(`../src/i18n/locales/${code}.json`, import.meta.url), 'utf8'));
const en = locale('en');
const hi = locale('hi');

const PAGES: [string, string][] = [
  ['/', en.app.tagline],
  ['/help', en.help.title],
  ['/emergency', en.sentMoney.title],
  ['/privacy', en.site.privacy],
  ['/terms', en.site.terms],
  ['/limitations', en.site.limitations],
];

test.describe('public pages', () => {
  for (const [path, heading] of PAGES) {
    test(`${path} is sent with its text, and opens directly`, async ({ page, request }) => {
      const html = await (await request.get(path)).text();
      expect(html).toContain(`>${heading}</h1>`); // before any script runs
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('a[href="tel:1930"]').first()).toBeVisible();
    });
  }

  test('the page fits the screen without sideways scrolling', async ({ page }) => {
    await page.goto('/');
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
  });

  test('the language menu switches the landing page to Hindi', async ({ page }) => {
    await page.goto('/');
    await page.locator('header select').selectOption('hi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hi.app.tagline);
  });

  test('a saved Hindi choice gets the Hindi page', async ({ page }) => {
    await page.goto('/design');
    await page.evaluate(() => localStorage.setItem('kavach.lang', 'hi'));
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hi.site.privacy);
  });

  test('an address that is not a public page shows nothing of the landing page', async ({
    page,
  }) => {
    await page.goto('/nothing-here');
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(en.app.tagline);
    await expect(page.locator('main')).toHaveCount(1);
  });
});
