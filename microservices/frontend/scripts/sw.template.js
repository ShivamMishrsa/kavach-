/* Kavach service worker. vite.config.ts fills in VERSION and PRECACHE at build time and writes this
 * file to the site root as sw.js. It does three things and nothing else:
 *
 *  1. Keeps the app itself (scripts, styles, English text, the six public pages) on the phone, so
 *     the website opens with no connection, and opens fast on a weak one.
 *  2. Opens pages from the network first, falling back to the saved copy after a few seconds, so a
 *     new version is never hidden behind an old one for someone who is online.
 *  3. Remembers other languages and fonts after they were first used.
 *
 * What it never does: touch the API (another address, not handled here), cache any answer that
 * is not a plain file of this site, or send anything. A person's notice, result or account is
 * never in these caches. A new version waits until the person agrees to reload (see the page).
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SAVED = `kavach-${VERSION}`;
const LATER = 'kavach-later';
const SHELL = '/'; // the landing page file doubles as the app's first screen for any address
const WAIT_FOR_NETWORK_MS = 3500;
// A script loaded with `crossorigin` sends an Origin header, the saved copy was fetched without one,
// and the server says `Vary: Origin`: without this the saved copy would not be found, offline.
const SAME_FILE = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SAVED).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== SAVED) await caches.delete(name); // older versions, and their later copies
      }
      await self.clients.claim();
    })(),
  );
});

/** A plain, successful answer from this site: the only kind that is ever kept. */
const keepable = (response) => response.ok && response.type === 'basic';

async function fromNetworkThenSaved(request) {
  try {
    return await Promise.race([
      fetch(request),
      new Promise((_, giveUp) => setTimeout(giveUp, WAIT_FOR_NETWORK_MS)),
    ]);
  } catch {
    const path = new URL(request.url).pathname;
    return (
      (await caches.match(path, SAME_FILE)) ??
      (await caches.match(SHELL, SAME_FILE)) ??
      Response.error()
    );
  }
}

async function fromSavedThenNetwork(request) {
  const saved = await caches.match(request, SAME_FILE);
  if (saved) return saved;
  const response = await fetch(request);
  if (keepable(response)) {
    const cache = await caches.open(LATER);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(fromNetworkThenSaved(request));
  } else if (/^\/(assets|icons)\//.test(url.pathname) || PRECACHE.includes(url.pathname)) {
    event.respondWith(fromSavedThenNetwork(request));
  }
});
