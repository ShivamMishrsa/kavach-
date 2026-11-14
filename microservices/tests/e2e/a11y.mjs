// Accessibility check with axe-core on the main screens: phone width, light / dark / high contrast /
// largest text, English and Hindi. A violation of any kind (WCAG 2.1 A and AA rules plus axe's best
// practices) fails the run. axe cannot judge everything: it finds about a third of the problems, so
// this does not replace trying the site with a screen reader and the keyboard.
// Usage: node a11y.mjs <outDir>   (normally started by run.ps1; add -Only a11y to run just this)
import { readFileSync } from 'node:fs';
import { connect } from './cdp.mjs';

const axeSource = readFileSync(new URL('../../frontend/node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const { sleep, ev, go, waitFor, check, finish } = await connect({
  out: process.argv[2],
  base: 'http://localhost:4173',
  prefix: 'a11y',
});

const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } };

/** Runs axe on the page as it is now. Returns what it found, one short line each. */
async function audit() {
  await ev(axeSource);
  const found = await ev(`axe.run(document, ${JSON.stringify(RULES)}).then((result) =>
    result.violations.map((v) => v.id + ' (' + v.impact + ') x' + v.nodes.length + ': ' + v.nodes[0].target.join(' ') + ' | ' + v.help))`);
  return Array.isArray(found) ? found : [`axe did not run: ${JSON.stringify(found)}`];
}

async function page(label, route, prepare) {
  await go(route);
  if (prepare) await prepare();
  await sleep(900);
  const found = await audit();
  check(`${label}: no accessibility violations`, found.length === 0, found.join(' || '));
}

const settings = (prefs, lang = 'en') =>
  ev(`localStorage.clear();
    localStorage.setItem('kavach.session', '{"kind":"guest"}');
    localStorage.setItem('kavach.onboarded', '1');
    localStorage.setItem('kavach.lang', '${lang}');
    localStorage.setItem('kavach.prefs', JSON.stringify(${JSON.stringify(prefs)}));
    localStorage.setItem('kavach.consent', JSON.stringify({version:'2026-11-v1', grantedAt:new Date().toISOString()}))`);

const LIGHT = { theme: 'light', text: 'normal', highContrast: false };
const SCREENS = ['/app', '/app/scan/notice', '/app/scan/link', '/app/history', '/app/help', '/app/sent-money', '/app/settings'];

// ---------- visitors without a session ----------
await go('/');
await ev(`localStorage.clear(); localStorage.setItem('kavach.prefs', JSON.stringify(${JSON.stringify(LIGHT)}))`);
for (const route of ['/', '/start', '/login', '/signup', '/help', '/emergency', '/privacy', '/terms', '/limitations', '/nothing-here']) {
  await page(`${route} (visitor)`, route);
}

// ---------- the app, light ----------
await settings(LIGHT);
for (const route of ['/language', ...SCREENS]) await page(`${route} (light)`, route);

// ---------- a result, details and the evidence summary ----------
await go('/app/scan/notice');
await sleep(500);
await ev(`document.querySelector('section[aria-labelledby=samples-title] button').click()`);
await waitFor(`!!document.querySelector('section[aria-labelledby=risk-title]')`, 15000);
await sleep(300);
const resultPath = await ev('location.pathname');
const found = await audit();
check('Result (light): no accessibility violations', found.length === 0, found.join(' || '));
await ev(`[...document.querySelectorAll('button')].find((b) => /looks wrong/i.test(b.textContent))?.click()`);
await sleep(500);
const dialog = await audit();
check('Feedback dialog: no accessibility violations', dialog.length === 0, dialog.join(' || '));
await ev(`document.querySelector('[role=dialog] button[aria-label]')?.click()`);
await page('Details (light)', `${resultPath}/details`);
await page('Evidence summary (light)', `${resultPath}/dossier`);

// ---------- the consent card and a confirmation dialog ----------
await page('Notice screen with the consent card (light)', '/app/scan/notice', () =>
  ev(`localStorage.removeItem('kavach.consent'); location.reload()`).then(() => sleep(1200)));
await page('Delete-history dialog (light)', '/app/settings', async () => {
  await ev(`[...document.querySelectorAll('main button')].find((b) => /delete all|history/i.test(b.textContent))?.click()`);
  await sleep(500);
});

// ---------- dark, high contrast, largest text, Hindi ----------
const MODES = {
  dark: [{ theme: 'dark', text: 'normal', highContrast: false }, 'en'],
  'high contrast': [{ theme: 'light', text: 'normal', highContrast: true }, 'en'],
  'largest text': [{ theme: 'light', text: 'xlarge', highContrast: false }, 'en'],
  'dark and high contrast': [{ theme: 'dark', text: 'normal', highContrast: true }, 'en'],
  Hindi: [LIGHT, 'hi'],
};
for (const [name, [prefs, lang]] of Object.entries(MODES)) {
  await settings(prefs, lang);
  for (const route of ['/app', '/app/scan/notice', '/app/settings']) await page(`${route} (${name})`, route);
}
await settings({ theme: 'dark', text: 'normal', highContrast: false });
await page('Landing page (dark)', '/', () => ev("localStorage.removeItem('kavach.session'); localStorage.removeItem('kavach.onboarded')"));

finish();
