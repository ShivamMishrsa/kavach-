// Screenshots + checks of the real flow in each regional language.
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const out = process.argv[2];
const langs = process.argv.slice(3);
const base = 'http://localhost:4173';
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => (ws.onopen = resolve));
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); return r.result.exceptionDetails ? { __error: true } : r.result.result.value; };
async function waitFor(expression, ms = 9000) { const end = Date.now() + ms; while (Date.now() < end) { const v = await ev(expression); if (v && !v.__error) return v; await sleep(150); } return false; }
async function shot(name) {
  const m = await send('Page.getLayoutMetrics');
  const h = Math.min(Math.ceil(m.result.cssContentSize.height), 2400);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 390, height: h, scale: 1 } });
  writeFileSync(path.join(out, `${process.env.PREFIX || 'lang'}-${name}.png`), Buffer.from(r.result.data, 'base64'));
}

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
let failed = 0;
const check = (name, pass) => { if (!pass) failed++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`); };

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
console.log(failed ? `${failed} checks failed` : 'all language checks passed');
ws.close();
process.exit(failed ? 1 : 0);
