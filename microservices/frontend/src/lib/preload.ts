import { isLowData } from './lowData';

/**
 * The screens are loaded when first visited, to keep the first download small. A phone that loses
 * its connection after opening the app would then fail on the first screen it had not seen yet (for
 * instance "home" after a check was saved for later). So once the app is open and the phone is idle
 * the main screens are fetched in the background, unless the person is saving data. (With the
 * service worker they are already on the phone; this covers the first visit.)
 */
export function preloadAppScreens(): void {
  if (isLowData()) return;
  // A screen that cannot be fetched (the connection just went) is simply not preloaded.
  const quietly = (loading: Promise<unknown>) => void loading.catch(() => undefined);
  const load = () => {
    quietly(import('@/pages/Home'));
    quietly(import('@/pages/ScanNotice'));
    quietly(import('@/pages/ScanLink'));
    quietly(import('@/pages/ScanView'));
    quietly(import('@/pages/History'));
    quietly(import('@/pages/Settings'));
    quietly(import('@/pages/Help'));
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 5000 });
  else setTimeout(load, 2000);
}
