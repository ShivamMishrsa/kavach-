import { createBrowserRouter, matchRoutes } from 'react-router';
import { routes } from '@/routes';

/**
 * Screens are loaded when first visited, so the router would start without the code of the screen
 * the address points to, and draw nothing until it arrived. That blank moment would also replace
 * the page that was written out in advance (see scripts/prerender.mjs). So the screens for the
 * current address are fetched first, while the rest of the app starts, and the router is made
 * after, with everything it needs for the first screen.
 */
async function loadFirstScreen(): Promise<void> {
  for (const match of matchRoutes(routes, window.location) ?? []) {
    if (typeof match.route.lazy !== 'function') continue;
    try {
      Object.assign(match.route, { ...(await match.route.lazy()), lazy: undefined });
    } catch {
      // Not there (no connection): the router tries again and shows its error screen.
    }
  }
}

/**
 * The router, made once the first screen is ready. Only the browser builds this: the server renders
 * from `routes` without a browser router. (Not a top-level `await` in this file: that made the
 * bundler split the app into many more files and about 35 KB more for the landing page.)
 */
export async function createAppRouter() {
  await loadFirstScreen();
  return createBrowserRouter(routes);
}
