// Records the key moments of the demo as a silent video with captions (about 45 seconds): the
// backup for when a live demo cannot be given (no internet, no projector, no time to set up). It
// drives a real browser through the script in docs/demo-script.md.
//
//   node scripts/record-demo.mjs <site> <output.webm>
//   node scripts/record-demo.mjs http://localhost:4174 ../../docs/demo/kavach-demo.webm
//
// <site> is the built website. With the real backend behind it (see tests/e2e/run.ps1 -Only record)
// the result and the PDF are real; against the demo build the results are simulated, and the
// "Demo mode" banner says so on screen. The video shows whichever it was.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [site = 'http://localhost:4173', output = 'kavach-demo.webm'] = process.argv.slice(2);
const sample = path.resolve('../../samples/fake-arrest-notice-en.png');
const SCAM_TEXT =
  'This is CBI. You are under digital arrest. Stay on the video call and transfer Rs 50,000 to the safe account now. Do not tell anyone.';

const dir = mkdtempSync(path.join(os.tmpdir(), 'kavach-video-'));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir, size: { width: 390, height: 844 } },
  serviceWorkers: 'block',
});
const page = await context.newPage();

/** The sentence being said, shown over the bottom of the screen. */
// (Shown for 80% of the seconds given: the file stays under the 5 MB the repository allows.)
async function say(text, seconds = 3) {
  await page.evaluate((words) => {
    let bar = document.getElementById('demo-caption');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-caption';
      bar.setAttribute('aria-hidden', 'true');
      bar.style.cssText =
        'position:fixed;left:8px;right:8px;top:8px;z-index:99999;padding:8px 12px;border-radius:12px;' +
        'background:rgba(15,23,42,.92);color:#fff;font:600 14px/1.35 system-ui,sans-serif;text-align:center;' +
        'pointer-events:none';
      // The video only gets a new frame when something on screen changes, so a still screen would
      // be cut out and the captions would fly past. A barely visible pulse keeps real time.
      const style = document.createElement('style');
      style.textContent = '@keyframes demo-pulse { from { opacity: .96 } to { opacity: 1 } }';
      bar.style.animation = 'demo-pulse 0.1s infinite alternate';
      document.head.append(style);
      document.body.append(bar);
    }
    bar.textContent = words;
  }, text);
  await page.waitForTimeout(seconds * 800);
}
const pause = (seconds) => page.waitForTimeout(seconds * 1000);

// ---------- 0:00 the problem ----------
await page.goto(site + '/');
await page.evaluate(() => localStorage.clear());
await page.goto(site + '/');
await say('A caller says you are "under digital arrest" and must pay now. Check first.', 4);
await page.mouse.wheel(0, 500);
await say('Kavach: a risk level and the reasons. Not a verdict.', 3);

// ---------- 0:15 getting in ----------
await page.getByRole('main').getByRole('link', { name: 'Check now' }).first().click();
await say('No sign-up needed.', 2);
await page.getByRole('button', { name: 'Continue without account' }).click();
await say('Seven languages. English first.', 2);
await page.getByRole('button', { name: 'Continue', exact: true }).click();
await pause(1);

// ---------- 0:30 consent, then the photo ----------
await page.getByRole('link', { name: /Notice, message or screenshot/ }).click();
await say('Consent first, in plain words. Nothing is sent before it.', 3);
await page.getByRole('button', { name: 'I agree' }).click();
await page.locator('input[type=file]:not([capture])').setInputFiles(sample);
await say('A photo of the notice (a made-up one, marked as a demo sample).', 3);
await page.getByRole('button', { name: 'Check now', exact: true }).click();

// ---------- 0:50 the result ----------
await page
  .locator('section[aria-labelledby=risk-title]')
  .waitFor({ timeout: 30_000 })
  .catch(async (error) => {
    await page.screenshot({ path: path.resolve(output) + '.error.png' }); // what the screen showed
    throw error;
  });
await say('Very high risk, and why: video call, safe account, money, secrecy, urgency.', 4);
await page.mouse.wheel(0, 500);
await say('What to do now: do not pay, call 1930.', 3);
await page.mouse.wheel(0, 500);
await say('The photo is deleted after 15 minutes.', 2);

// ---------- 1:10 the evidence summary ----------
await page.getByRole('link', { name: 'Review details and create report' }).click();
await say('The details it read (amount, account, phone). You correct them.', 3);
await page.locator('main input[type=checkbox]').first().click();
await page.getByRole('button', { name: 'Create evidence summary' }).click();
await say('A summary to read out to the 1930 helpline, with fingerprints of the evidence.', 4);

// ---------- 1:30 offline ----------
await page.goto(site + '/app');
await pause(2); // the app fetches its other screens when idle
await context.setOffline(true);
await say('No internet? The app still opens, and 1930 works by phone.', 3);
await page.getByRole('link', { name: /Notice, message or screenshot/ }).click();
await page.getByRole('radio', { name: /Paste text/ }).click();
await page.locator('textarea').fill(SCAM_TEXT);
await page.getByRole('button', { name: 'Check now', exact: true }).click();
await say('A check is kept on this phone and sent when the connection returns.', 4);
await context.setOffline(false);
await say('Back online: sent, and deleted from the phone.', 4);

// ---------- 1:50 honesty ----------
await page.goto(site + '/limitations');
await say('What it cannot do is written down. No accuracy percentage is claimed.', 4);
await say('Kavach. Check before you pay.', 2);

const video = page.video();
await context.close();
mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
copyFileSync(await video.path(), path.resolve(output));
rmSync(dir, { recursive: true, force: true });
await browser.close();
console.log(`demo video: ${path.resolve(output)}`);
