import { isLowData } from '@/lib/lowData';

/**
 * Installs the service worker (scripts/sw.template.js) once the page has loaded (not before: it must
 * not compete with the page for the network), in the built site
 * only. When a new version has been downloaded it does not take over by itself: `onUpdate` is
 * called with a function that does it, so the person can finish what they are doing first.
 */
export function registerServiceWorker(onUpdate: (apply: () => void) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  // Saving the app on the phone downloads all of it (about 350 KB, once). Not for someone who has
  // asked to save data, or whose phone says data is short or the network very slow.
  if (isLowData()) return;

  // The first worker takes control of the page that installed it: that is not an update, so only a
  // change of worker on a page that already had one reloads it.
  const hadWorker = navigator.serviceWorker.controller !== null;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadWorker && !reloading) {
      reloading = true;
      location.reload();
    }
  });

  const start = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const offerUpdate = () => {
          const waiting = registration.waiting;
          if (waiting && navigator.serviceWorker.controller) {
            onUpdate(() => waiting.postMessage('skip-waiting'));
          }
        };
        offerUpdate();
        registration.addEventListener('updatefound', () => {
          const next = registration.installing;
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed') offerUpdate();
          });
        });
      })
      .catch(() => undefined); // no worker: the site works as before, just not offline
  };
  // After the page has loaded and the phone is idle, so it never competes with what the person is
  // waiting for. (The app can start after the page's load event, so look at where the page is.)
  const whenIdle = () =>
    'requestIdleCallback' in window
      ? window.requestIdleCallback(start, { timeout: 10_000 })
      : setTimeout(start, 3000);
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}
