import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, signedInGuest, test } from './fixtures';

const locale = (code: string) =>
  JSON.parse(readFileSync(new URL(`../src/i18n/locales/${code}.json`, import.meta.url), 'utf8'));
const en = locale('en');
const hi = locale('hi');

const SCAM =
  'This is CBI. You are under digital arrest. Transfer Rs. 50000 to the safe account immediately. Do not tell anyone.';

// This file is about the service worker, so it is allowed here (it is blocked in the other files).
test.use({ serviceWorkers: 'allow' });

/** Waits until the service worker has saved the app, so the next page can open without a network. */
async function installed(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready); // installed, so everything is saved
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null); // and in charge
}

/** A real picture that does not compress well (noise), as a PNG of roughly 2.4 bytes per pixel. */
async function noisyPng(page: Page, side: number): Promise<Buffer> {
  const url = await page.evaluate((size) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d')!;
    const picture = context.createImageData(size, size);
    for (let i = 0; i < picture.data.length; i++) {
      picture.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
    }
    context.putImageData(picture, 0, 0);
    return canvas.toDataURL('image/png');
  }, side);
  return Buffer.from(url.split(',')[1], 'base64');
}

test.describe('installable', () => {
  test('the manifest is linked and complete, and every icon in it exists', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Only Chromium reads the manifest into the page');
    await page.goto('/');
    const href = await page.locator('link[rel=manifest]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    const manifest = await (await request.get(href!)).json();

    expect(manifest.name).toContain('Kavach');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toMatch(/^\/app/);
    expect(manifest.scope).toBe('/');
    expect(manifest.theme_color).toBe('#1d4ed8');
    const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
    for (const shortcut of manifest.shortcuts) expect(shortcut.url).toMatch(/^\/app\//);
    expect(manifest.share_target.action).toBe('/app/share');
  });

  test('the home screen icon for iPhone and the head tags are there', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel=apple-touch-icon]')).toHaveAttribute(
      'href',
      '/icons/apple-touch-icon.png',
    );
    await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#1d4ed8');
  });

  test('Settings offers to install when the browser says it can', async ({ page }) => {
    await signedInGuest(page);
    await page.goto('/app/settings');
    await expect(page.getByRole('button', { name: en.install.button })).toHaveCount(0);
    await page.evaluate(() => {
      const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => {
          (window as unknown as { __prompted: boolean }).__prompted = true;
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(offer);
    });
    await page.getByRole('button', { name: en.install.button }).click();
    expect(
      await page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted),
    ).toBe(true);
    await expect(page.getByRole('button', { name: en.install.button })).toHaveCount(0); // offered once
  });
});

test.describe('works without a connection', () => {
  test('the public pages open offline after one visit', async ({ page, context }) => {
    await page.goto('/');
    await installed(page);
    await context.setOffline(true);
    for (const [path, heading] of [
      ['/help', en.help.title],
      ['/privacy', en.site.privacy],
      ['/emergency', en.sentMoney.title],
      ['/', en.app.tagline],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    }
    await expect(page.locator('a[href="tel:1930"]').first()).toBeVisible();
  });

  test('the whole demo works offline: open the app, check a message, read the result', async ({
    page,
    context,
  }) => {
    await signedInGuest(page);
    await page.goto('/app');
    await installed(page);
    await context.setOffline(true);

    await page.goto('/app/scan/notice');
    await expect(page.getByText(en.offline.bannerDemo)).toBeVisible();
    await page.getByRole('radio', { name: /Paste text/ }).click();
    await page.locator('textarea').fill(SCAM);
    await page.getByRole('button', { name: 'Check now', exact: true }).click();
    await expect(page.getByText('Very high risk')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Demands a money transfer')).toBeVisible();
  });

  test('a message appears when the connection goes, and goes when it returns', async ({
    page,
    context,
  }) => {
    await signedInGuest(page);
    await page.goto('/app');
    // The app must be running (listening) before the connection goes, or the event is missed.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(en.home.title);
    await expect(page.getByText(en.offline.bannerDemo)).toHaveCount(0);
    await context.setOffline(true);
    await expect(page.getByRole('status').filter({ hasText: en.offline.bannerDemo })).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(en.offline.bannerDemo)).toHaveCount(0);
  });

  test('a language used once is there offline too', async ({ page, context }) => {
    await signedInGuest(page, 'hi');
    await page.goto('/app');
    await installed(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
    await page.reload(); // the Hindi text and fonts are now kept by the worker
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hi.home.title);
    await context.setOffline(true);
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hi.home.title);
  });
});

test.describe('quick scan from another app, or from the home screen icon', () => {
  test('a message shared to Kavach opens the notice check with the text in it, and leaves no trace in the address', async ({
    page,
  }) => {
    await signedInGuest(page);
    await page.goto(`/app/share?text=${encodeURIComponent(SCAM)}&title=Forwarded`);
    await expect(page).toHaveURL(/\/app\/scan\/notice$/);
    await expect(page.locator('textarea')).toHaveValue(/digital arrest/);
    const kept = await page.evaluate(() => JSON.stringify(history.state));
    expect(kept).not.toContain('digital arrest'); // read once, then removed from the history entry
  });

  test('a shared link opens the link check', async ({ page }) => {
    await signedInGuest(page);
    await page.goto(`/app/share?url=${encodeURIComponent('https://sbi-kyc-update.example/login')}`);
    await expect(page).toHaveURL(/\/app\/scan\/link$/);
    await expect(page.locator('input[type=url]')).toHaveValue(
      'https://sbi-kyc-update.example/login',
    );
  });

  test('sharing nothing just opens the app', async ({ page }) => {
    await signedInGuest(page);
    await page.goto('/app/share');
    await expect(page).toHaveURL(/\/app$/);
  });

  test('from the icon\'s "Check" shortcut to a result takes three actions', async ({ page }) => {
    await signedInGuest(page); // set up, consent already given
    await page.goto('/app/scan/notice?source=shortcut'); // what the shortcut opens
    let actions = 0;
    await page.getByRole('radio', { name: /Paste text/ }).click();
    actions++;
    await page.locator('textarea').fill(SCAM);
    actions++;
    await page.getByRole('button', { name: 'Check now', exact: true }).click();
    actions++;
    await expect(page.getByText('Very high risk')).toBeVisible({ timeout: 15_000 });
    expect(actions).toBeLessThanOrEqual(3);
  });
});

test.describe('saving data', () => {
  test('the choice is kept', async ({ page }) => {
    await signedInGuest(page);
    await page.goto('/app/settings');
    await page.getByRole('radio', { name: en.lowData.on }).click();
    expect(await page.evaluate(() => localStorage.getItem('kavach.lowdata'))).toBe('on');
  });

  test('a big photo is announced, sent as a smaller copy, and a small one is left alone', async ({
    page,
  }) => {
    await signedInGuest(page);
    await page.goto('/app/scan/notice');
    const picker = page.locator('input[type=file]:not([capture])');

    await picker.setInputFiles({
      name: 'small.png',
      mimeType: 'image/png',
      buffer: await noisyPng(page, 100),
    });
    await expect(page.getByText(en.upload.willShrink)).toHaveCount(0);

    await picker.setInputFiles({
      name: 'notice.png',
      mimeType: 'image/png',
      buffer: await noisyPng(page, 800), // about 1.9 MB, over the 1.5 MB limit
    });
    await expect(page.getByText(en.upload.willShrink)).toBeVisible();
    await page.getByRole('button', { name: 'Check now', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/scan\/scn_/, { timeout: 20_000 });

    // What was sent is the smaller copy, a JPEG: the demo keeps the file's name with the result.
    const sent = await page.evaluate(() => localStorage.getItem('kavach.mock.scans') ?? '');
    expect(sent).toContain('notice.jpg');
    expect(sent).not.toContain('notice.png');
  });

  test('with Save data on, a photo over 0.4 MB is also made smaller', async ({ page }) => {
    await signedInGuest(page);
    await page.goto('/app/settings');
    await page.getByRole('radio', { name: en.lowData.on }).click();
    await page.goto('/app/scan/notice');
    await page.locator('input[type=file]:not([capture])').setInputFiles({
      name: 'notice.png',
      mimeType: 'image/png',
      buffer: await noisyPng(page, 400), // about 0.5 MB: under the usual limit, over this one
    });
    await expect(page.getByText(en.upload.willShrink)).toBeVisible();
  });
});
