import { accessibilityProblems, expect, signedInGuest, test } from './fixtures';

const VISITOR = [
  '/',
  '/start',
  '/login',
  '/signup',
  '/help',
  '/emergency',
  '/privacy',
  '/terms',
  '/limitations',
  '/nothing-here',
];
const APP = [
  '/app',
  '/app/scan/notice',
  '/app/scan/link',
  '/app/history',
  '/app/help',
  '/app/sent-money',
  '/app/settings',
];

test.describe('accessibility (axe: WCAG 2.1 A and AA, best practices)', () => {
  for (const path of VISITOR) {
    test(`${path} (visitor)`, async ({ page }) => {
      await page.goto('/design');
      await page.evaluate(() => localStorage.clear());
      await page.goto(path);
      await page.locator('h1').first().waitFor();
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
  for (const path of APP) {
    test(`${path} (guest)`, async ({ page }) => {
      await signedInGuest(page);
      await page.goto(path);
      await page.locator('main').waitFor();
      expect(await accessibilityProblems(page)).toEqual([]);
    });
  }
  test('the Hindi home screen', async ({ page }) => {
    await signedInGuest(page, 'hi');
    await page.goto('/app');
    await page.locator('main').waitFor();
    expect(await accessibilityProblems(page)).toEqual([]);
  });
});
