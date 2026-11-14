// Checks kept on the phone while there is no connection, against the REAL backend: saved when the
// network is gone, shown on the home screen, sent by themselves when it returns, and deleted in
// every way the person (or the clock) can ask for.
// Usage: node offline.mjs <outDir> <noticeImage>   (normally started by run.ps1; -Only offline)
import { readFileSync } from 'node:fs';
import { connect } from './cdp.mjs';

const [out, noticeImage] = process.argv.slice(2);
const en = JSON.parse(
  readFileSync(new URL('../../frontend/src/i18n/locales/en.json', import.meta.url), 'utf8'),
);
const { send, sleep, ev, waitFor, hasText, waitText, clickText, setValue, chooseFile, go, shot, check, finish } =
  await connect({ out, base: 'http://localhost:4174', prefix: 'offline' });

const offline = (on) =>
  send('Network.emulateNetworkConditions', {
    offline: on,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

/** What is in the phone's pending store (IndexedDB), as [{kind, savedAt}]. */
const kept = () =>
  ev(`new Promise((resolve) => {
    const open = indexedDB.open('kavach-pending', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('checks', { keyPath: 'id' });
    open.onsuccess = () => {
      const all = open.result.transaction('checks').objectStore('checks').getAll();
      all.onsuccess = () => resolve(all.result.map((c) => ({ kind: c.input.kind, savedAt: c.savedAt })));
    };
  })`);

const start = async () => {
  await offline(false); // a page cannot be loaded without a connection
  await go('/design');
  await ev(`localStorage.clear();
    localStorage.setItem('kavach.session', '{"kind":"guest"}');
    localStorage.setItem('kavach.onboarded', '1');
    localStorage.setItem('kavach.lang', 'en');
    localStorage.setItem('kavach.consent', JSON.stringify({version:'2026-11-v1', grantedAt:new Date().toISOString()}))`);
  await ev(`indexedDB.deleteDatabase('kavach-pending')`);
  await go('/app/scan/notice');
  await waitFor(`!!document.querySelector('textarea') || !![...document.querySelectorAll('[role=radio]')].length`);
  await clickText('[role=radio]', 'Paste text');
  await sleep(1500); // the app fetches its other screens when idle, before a connection can be lost
};
const typeAndCheck = async (message) => {
  await setValue('textarea', message);
  await sleep(150);
  await clickText('button', 'Check now');
};

const SCAM = 'This is CBI. You are under digital arrest. Stay on the video call. Transfer Rs 50,000 to the safe account now.';

// ---------- the message while offline ----------
await start();
await offline(true);
check('Offline: the screen says there is no connection (and 1930 still works by phone)', await waitText(en.offline.banner.slice(0, 40)));
await typeAndCheck(SCAM);
check('Offline: the check is kept, and the person is told so', await waitText(en.pending.saved.slice(0, 40)));
check('Offline: the person is taken home', await waitFor(`location.pathname === '/app'`));
check('Offline: home lists it under "Waiting for a connection"', (await waitText(en.pending.title)) && (await ev(hasText(en.pending.note.slice(0, 30)))));
const saved = await kept();
check('Offline: exactly one check is on the phone, a notice with a time', saved.length === 1 && saved[0].kind === 'notice' && Math.abs(Date.now() - saved[0].savedAt) < 60_000);
await shot('1-waiting');

// ---------- the connection returns ----------
await offline(false);
check('Online again: it is sent by itself and the person is told it is ready', await waitText(en.pending.sent, 20000));
check('Online again: the "waiting" list is gone', await waitFor(`!document.body.innerText.includes(${JSON.stringify(en.pending.title)})`, 10000));
check('Online again: nothing is left on the phone', (await kept()).length === 0);
await clickText('button', en.pending.open);
check('The toast opens the real result', (await waitFor(`/^\\/app\\/scan\\/[\\w-]+$/.test(location.pathname)`)) && (await waitFor(`!!document.querySelector('section[aria-labelledby=risk-title]')`, 25000)));
check('The result is real, not a demo', await ev(`!document.body.innerText.includes(${JSON.stringify(en.scan.simulatedNote)})`));
await shot('2-sent');

// ---------- a photo while offline ----------
await start();
await clickText('[role=radio]', 'Photo or file');
await offline(true);
await chooseFile('input[type=file]:not([capture])', noticeImage);
await waitFor(`!!document.querySelector('img[alt]')`);
await sleep(300);
await ev(`[...document.querySelectorAll('main fieldset button')].filter((b) => !b.disabled).pop().click()`);
check('A photo is kept too', (await waitText(en.pending.saved.slice(0, 40))) && (await kept()).some((c) => c.kind === 'notice'));
await offline(false);
check('The photo is sent when the connection returns', await waitText(en.pending.sent, 25000));
check('... and nothing is left', (await kept()).length === 0);

// ---------- ways out ----------
await start();
await offline(true);
await typeAndCheck(SCAM);
await waitText(en.pending.title);
await clickText('button', en.pending.remove);
check('"Remove" deletes it at once', (await waitFor(`!document.body.innerText.includes(${JSON.stringify(en.pending.title)})`)) && (await kept()).length === 0);

await start();
await offline(true);
await typeAndCheck(SCAM);
await waitText(en.pending.title);
await clickText('a', 'Settings'); // inside the app: there is no connection to load a page
await waitFor(`location.pathname === '/app/settings'`);
await sleep(500);
await clickText('button', en.history.deleteAll);
await clickText('[role=dialog] button', en.history.deleteAll);
await sleep(600);
check('"Delete all my data" deletes what is waiting too', (await kept()).length === 0);

await start();
await offline(true);
await typeAndCheck(SCAM);
await waitText(en.pending.title);
await clickText('a', 'Settings'); // inside the app: there is no connection to load a page
await waitFor(`location.pathname === '/app/settings'`);
await clickText('button', en.settings.withdraw);
await sleep(600);
check('Withdrawing consent deletes what is waiting (nothing may be sent without it)', (await kept()).length === 0);
await offline(false);

// ---------- the clock ----------
await start();
await offline(true);
await typeAndCheck(SCAM);
await waitText(en.pending.title);
await ev(`new Promise((resolve) => {
  const open = indexedDB.open('kavach-pending', 1);
  open.onsuccess = () => {
    const table = open.result.transaction('checks', 'readwrite').objectStore('checks');
    const all = table.getAll();
    all.onsuccess = () => {
      for (const item of all.result) table.put({ ...item, savedAt: Date.now() - 2 * 3600 * 1000 });
      resolve(true);
    };
  };
})`);
await offline(false);
await go('/app');
await sleep(1500);
check('A check older than an hour is deleted, not sent', (await kept()).length === 0 && !(await ev(hasText(en.pending.sent))));

await offline(false);
await finish();
