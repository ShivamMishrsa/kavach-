import { expect, signedInGuest, test } from './fixtures';

const SCAM =
  'This is CBI. You are under digital arrest. Transfer Rs. 50000 to the safe account immediately. Do not tell anyone. Pay to scam@okaxis, call 9876543210';

test('first visit: landing, welcome, guest, language, home', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.getByRole('main').getByRole('link', { name: 'Check now' }).first().click();
  await expect(page).toHaveURL(/\/start$/);
  await page.getByRole('button', { name: 'Continue without account' }).click();
  await expect(page).toHaveURL(/\/language$/);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('What would you like to check?')).toBeVisible();
});

test('the app is closed to someone who has not started', async ({ page }) => {
  await page.goto('/design');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/app');
  await expect(page).toHaveURL(/\/$/);
});

test('pasted text: consent, check, result with reasons and the 15-minute note', async ({
  page,
}) => {
  await page.goto('/design');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('kavach.session', '{"kind":"guest"}');
    localStorage.setItem('kavach.onboarded', '1');
  });
  await page.goto('/app/scan/notice');
  const check = page.getByRole('button', { name: 'Check now', exact: true });
  await expect(page.getByRole('heading', { name: 'Your consent' })).toBeVisible();
  await expect(check).toBeDisabled(); // locked until consent is given
  await page.getByRole('button', { name: 'I agree' }).click();
  await page.getByRole('radio', { name: /Paste text/ }).click();
  await page.locator('textarea').fill(SCAM);
  await expect(check).toBeEnabled();
  await check.click();
  await expect(page).toHaveURL(/\/app\/scan\/scn_/);
  await expect(page.getByText('Very high risk')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Demands a money transfer')).toBeVisible();
  await expect(page.getByText('will be deleted at')).toBeVisible();
  await expect(page.getByText(/not a final verdict/).first()).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/\d+\s?%/); // never an accuracy percentage
});

test('the app works in Hindi', async ({ page }) => {
  await signedInGuest(page, 'hi');
  await page.goto('/app');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await expect(page.getByRole('main')).not.toContainText('What would you like to check?');
});
