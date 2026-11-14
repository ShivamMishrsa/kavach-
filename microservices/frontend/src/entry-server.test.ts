import { matchRoutes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { render } from './entry-server';
import type { RouteHandle } from './layouts/RootLayout';
import { PUBLIC_PATHS } from './publicPages';
import { routes } from './routes';

describe('pages written out in advance', () => {
  it.each(PUBLIC_PATHS)('%s is a public route that names its own title', (path) => {
    const handle = matchRoutes(routes, path)?.at(-1)?.route.handle as RouteHandle | undefined;
    expect(handle?.title).toBeTruthy();
  });

  it('every public route is in the list', () => {
    const named = new Set<string>();
    const walk = (list: typeof routes, prefix: string) => {
      for (const route of list) {
        const path = route.path ? `${prefix}${route.path}`.replace(/\/+/g, '/') : prefix;
        if ((route.handle as RouteHandle | undefined)?.title) named.add(route.index ? '/' : path);
        walk(route.children ?? [], path === '' ? '/' : `${path}/`);
      }
    };
    walk(routes, '/');
    expect([...named].sort()).toEqual([...PUBLIC_PATHS].sort());
  });

  it.each(PUBLIC_PATHS)('%s has its content, one h1 and a title', async (path) => {
    const page = await render(path);
    expect(page.html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(page.title).toMatch(/· Kavach$/);
    expect(page.html).not.toContain('animate-spin'); // not the "waiting for the server" spinner
  });

  it('the privacy policy is in the page, not only in the scripts', async () => {
    const { html, title } = await render('/privacy');
    expect(title).toBe('Privacy policy · Kavach');
    expect(html).toContain('Privacy policy');
    expect(html.length).toBeGreaterThan(5_000);
  });

  it('the landing page has its call to action', async () => {
    const { html } = await render('/');
    expect(html).toContain('href="/start"');
  });
});
