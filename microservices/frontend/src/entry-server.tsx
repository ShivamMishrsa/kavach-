/* eslint-disable react-refresh/only-export-components -- never loaded in a browser */
// Runs in Node at build time (scripts/prerender.mjs), never in the browser. It turns a public page
// into HTML, in English, so that search engines and a slow phone get content before any script runs.
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { Providers } from '@/Providers';
import i18n from '@/i18n';
import type { RouteHandle } from '@/layouts/RootLayout';
import { pageMeta } from '@/lib/pageMeta';
import { routes } from '@/routes';

export { PUBLIC_PATHS } from '@/publicPages';

export interface RenderedPage {
  html: string;
  title: string;
  description: string;
}

/** The page at `path` as it looks to someone who has never visited. */
export async function render(path: string): Promise<RenderedPage> {
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`https://kavach.invalid${path}`));
  if (context instanceof Response) throw new Error(`${path} redirects, so it is not a public page`);
  const router = createStaticRouter(handler.dataRoutes, context);
  const html = renderToString(
    <Providers>
      <StaticRouterProvider router={router} context={context} hydrate={false} />
    </Providers>,
  );
  const handle = context.matches.at(-1)?.route.handle as RouteHandle | undefined;
  return { html, ...pageMeta(i18n.t.bind(i18n), handle?.title) };
}
