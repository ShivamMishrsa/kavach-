// How fast the website opens on a slow phone: a "Fast 3G"-like network (1.6 Mbit/s, 150 ms delay,
// the setting Lighthouse uses for mobile) and a processor 4 times slower than this computer.
// The preview server compresses files like a real host does, so the sizes are what a person downloads.
// Usage: node perf.mjs <outDir>   (normally started by run.ps1; add -Only perf to run just this)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { connect } from './cdp.mjs';

// What the pages must stay under on that network. Measured, then rounded up a little.
const BUDGET = {
  landingKilobytes: 240, // everything downloaded to show the landing page, compressed (it includes the page written out in advance, about 8 KB)
  landingFirstPaintMs: 3500,
  appFirstPaintMs: 4000,
};
const RUNS = 3;

const { send, on, sleep, ev, go, check, finish } = await connect({
  out: process.argv[2],
  base: 'http://localhost:4173',
  prefix: 'perf',
});

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

let current = null; // the page load being measured
on('Network.requestWillBeSent', ({ requestId, type, request }) => {
  if (current) current.requests.set(requestId, { type, url: request.url, bytes: 0 });
});
on('Network.loadingFinished', ({ requestId, encodedDataLength }) => {
  const request = current?.requests.get(requestId);
  if (request) request.bytes = encodedDataLength;
});

async function throttle(on) {
  await send('Network.emulateNetworkConditions', {
    offline: false,
    latency: on ? 150 : 0,
    downloadThroughput: on ? (1.6 * 1024 * 1024) / 8 : -1,
    uploadThroughput: on ? (750 * 1024) / 8 : -1,
  });
  await send('Emulation.setCPUThrottlingRate', { rate: on ? 4 : 1 });
}

async function load(route) {
  current = { requests: new Map() };
  await throttle(true);
  await send('Page.navigate', { url: `http://localhost:4173${route}` });
  const ready = Date.now() + 40000;
  while (Date.now() < ready && (await ev('document.readyState')) !== 'complete') await sleep(100);
  await sleep(1500); // fonts and lazy pages that start after the load event
  const timing = await ev(`(() => {
    const paint = performance.getEntriesByName('first-contentful-paint')[0];
    const largest = performance.getEntriesByType('largest-contentful-paint').at(-1);
    const navigation = performance.getEntriesByType('navigation')[0];
    return { firstPaint: paint?.startTime ?? null, largest: largest?.startTime ?? null, loaded: navigation?.loadEventEnd ?? null };
  })()`);
  const requests = [...current.requests.values()];
  const result = {
    ...timing,
    kilobytes: requests.reduce((sum, request) => sum + request.bytes, 0) / 1024,
    scriptKilobytes: requests.filter((r) => r.type === 'Script').reduce((sum, r) => sum + r.bytes, 0) / 1024,
    requests: requests.length,
    biggest: requests.sort((a, b) => b.bytes - a.bytes).slice(0, 4).map((r) => `${path.basename(new URL(r.url).pathname)} ${(r.bytes / 1024).toFixed(0)} KB`),
  };
  current = null;
  await throttle(false);
  return result;
}

async function measure(name, route, prepare) {
  await go('/');
  await prepare();
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    await send('Network.clearBrowserCache');
    runs.push(await load(route));
  }
  const row = {
    page: name,
    firstPaintMs: Math.round(median(runs.map((r) => r.firstPaint))),
    largestMs: Math.round(median(runs.map((r) => r.largest ?? r.firstPaint))),
    kilobytes: Math.round(median(runs.map((r) => r.kilobytes))),
    scriptKilobytes: Math.round(median(runs.map((r) => r.scriptKilobytes))),
    requests: runs[0].requests,
    biggest: runs[0].biggest,
  };
  console.log(
    `${name.padEnd(34)} first paint ${row.firstPaintMs} ms, main content ${row.largestMs} ms, ` +
      `${row.kilobytes} KB (${row.scriptKilobytes} KB scripts) in ${row.requests} files; biggest: ${row.biggest.join(', ')}`,
  );
  return row;
}

await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

const asGuest = (lang) => () =>
  ev(`localStorage.clear(); localStorage.setItem('kavach.session', '{"kind":"guest"}'); localStorage.setItem('kavach.onboarded','1'); localStorage.setItem('kavach.lang','${lang}'); localStorage.setItem('kavach.consent', JSON.stringify({version:'2026-11-v1', grantedAt:new Date().toISOString()}))`);

const rows = [
  await measure('Landing page, English', '/', () => ev('localStorage.clear()')),
  await measure('Landing page, Hindi', '/', () => ev("localStorage.clear(); localStorage.setItem('kavach.lang','hi')")),
  await measure('App home, English (returning guest)', '/app', asGuest('en')),
  await measure('App home, Hindi (returning guest)', '/app', asGuest('hi')),
  await measure('App home, Tamil (returning guest)', '/app', asGuest('ta')),
];
writeFileSync(path.join(process.argv[2], 'perf.json'), JSON.stringify(rows, null, 2));

const landing = rows[0];
check(`Landing page downloads at most ${BUDGET.landingKilobytes} KB`, landing.kilobytes <= BUDGET.landingKilobytes, `${landing.kilobytes} KB`);
check(`Landing page paints within ${BUDGET.landingFirstPaintMs} ms on a slow phone`, landing.firstPaintMs <= BUDGET.landingFirstPaintMs, `${landing.firstPaintMs} ms`);
for (const row of rows.slice(2)) {
  check(`${row.page} paints within ${BUDGET.appFirstPaintMs} ms on a slow phone`, row.firstPaintMs <= BUDGET.appFirstPaintMs, `${row.firstPaintMs} ms`);
}
finish();
