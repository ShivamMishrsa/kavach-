// Checks of the demo flow in each regional language, with screenshots.
// Usage: node languages.mjs <outDir> <lang>...   (PREFS / PREFIX: see README)
import { connect } from './cdp.mjs';

const base = 'http://localhost:4173';
const langs = process.argv.slice(3);
const { sleep, ev, send, waitFor, check, shot, finish } = await connect({
  out: process.argv[2],
  base,
  prefix: process.env.PREFIX || 'lang',
});

for (const lang of langs) {
  await send('Page.navigate', { url: base + '/' });
  await sleep(800);
  await ev(`localStorage.clear(); localStorage.setItem('kavach.session', '{"kind":"guest"}'); localStorage.setItem('kavach.onboarded','1'); localStorage.setItem('kavach.lang','${lang}'); localStorage.setItem('kavach.consent', JSON.stringify({version:'2026-11-v1', grantedAt:new Date().toISOString()})); ${process.env.PREFS ? `localStorage.setItem('kavach.prefs', ${JSON.stringify(process.env.PREFS)});` : ''}`);
  await send('Page.navigate', { url: base + '/app' });
  await sleep(1500);
  check(`[${lang}] html lang is ${lang}`, (await ev('document.documentElement.lang')) === lang);
  check(`[${lang}] home shows no raw translation key`, !(await ev(`/\\b(home|common|nav|welcome)\\.[a-zA-Z]+\\b/.test(document.body.innerText)`)));
  await shot(`${lang}-1-home`);

  await send('Page.navigate', { url: base + '/app/scan/notice' });
  await sleep(1200);
  const limited = lang !== 'hi' && lang !== 'en';
  check(`[${lang}] limited-scan note ${limited ? 'is shown' : 'is hidden'}`, (await ev(`!!document.querySelector('p[role=note].bg-chip')`)) === limited);
  await shot(`${lang}-2-notice`);
  await ev(`document.querySelector('section[aria-labelledby=samples-title] button').click()`);
  const ok = await waitFor(`!!document.querySelector('section[aria-labelledby=risk-title]')`, 12000);
  check(`[${lang}] result screen appears`, ok);
  check(`[${lang}] result shows no raw translation key`, !(await ev(`/\\b(risk|reasons|next|scan|steps)\\.[a-zA-Z_]+\\b/.test(document.body.innerText)`)));
  check(`[${lang}] 1930 call button is present`, await ev(`!!document.querySelector('a[href="tel:1930"]')`));
  await shot(`${lang}-3-result`);

  await ev(`[...document.querySelectorAll('a')].find(a => a.href.endsWith('/details')).click()`);
  await waitFor(`location.pathname.endsWith('/details')`);
  await sleep(500);
  await ev(`document.querySelector('main input[type=checkbox]').click()`);
  await sleep(200);
  await ev(`[...document.querySelectorAll('main button')].filter(b => !b.disabled).pop().click()`);
  const dos = await waitFor(`location.pathname.endsWith('/dossier')`);
  check(`[${lang}] dossier opens`, dos);
  await sleep(500);
  check(`[${lang}] dossier script includes the UPI id`, await ev(`document.querySelector('blockquote')?.innerText.includes('safe.verification@upi')`));
  await shot(`${lang}-4-dossier`);
}
finish();
