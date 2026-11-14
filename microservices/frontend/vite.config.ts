import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import compression from 'compression';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { precacheList, serviceWorkerSource } from './scripts/serviceWorker.ts';
import { PUBLIC_PATHS } from './src/publicPages.ts';

/**
 * Headers every page of the website is sent with. Scripts may only come from the site itself;
 * styles may be inline because the toast library adds its own; the only other place the page may
 * talk to is the API. They are written to `_headers` (Cloudflare Pages and Netlify read it) and
 * used by `vite preview`, so the browser tests run under the same rules as the live site.
 */
/**
 * The small script that scripts/prerender.mjs puts in every written-out page. It is inline, so the
 * policy names it by its hash: any other inline script is still refused.
 */
const SKIP_PRERENDER = readFileSync(
  path.join(import.meta.dirname, 'scripts/skip-prerender.js'),
  'utf8',
).trim();
const SKIP_PRERENDER_HASH = `'sha256-${createHash('sha256').update(SKIP_PRERENDER).digest('base64')}'`;

function securityHeaders(apiUrl: string | undefined): Record<string, string> {
  const api = apiUrl ? new URL(apiUrl).origin : '';
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      `script-src 'self' ${SKIP_PRERENDER_HASH}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ${api}`.trim(),
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

/**
 * What a real host does and the preview server does not:
 * - robots.txt (the app itself is not for search engines) and, when VITE_SITE_URL is set, a
 *   sitemap of the public pages. Without the real address no sitemap is written;
 * - `_headers` with the security headers;
 * - the preview server compresses files and sends those headers.
 */
function production(siteUrl: string | undefined, apiUrl: string | undefined): Plugin {
  const origin = siteUrl?.replace(/\/$/, '');
  const headers = securityHeaders(apiUrl);
  const file = (lines: string[]) => `${lines.join('\n')}\n`;
  return {
    name: 'kavach-production',
    // The server build that scripts/prerender.mjs makes is not the website: no extra files for it.
    apply: (config, { command }) => command !== 'build' || !config.build?.ssr,
    configurePreviewServer(server) {
      // The compression package is written for Express; Vite's server calls it the same way.
      server.middlewares.use(
        compression() as unknown as (
          request: IncomingMessage,
          response: ServerResponse,
          next: () => void,
        ) => void,
      );
      server.middlewares.use((_request, response, next) => {
        for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
        next();
      });
    },
    generateBundle(_options, bundle) {
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /app', 'Disallow: /design'];
      if (origin) robots.push(`Sitemap: ${origin}/sitemap.xml`);
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: file(robots) });
      const rules = Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`);
      // Files with a hash in the name never change; the service worker must always be looked at.
      const headerFile = [
        '/*',
        ...rules,
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '/sw.js',
        '  Cache-Control: no-cache',
      ];
      this.emitFile({ type: 'asset', fileName: '_headers', source: file(headerFile) });
      const worker = serviceWorkerSource(precacheList(bundle, PUBLIC_PATHS), import.meta.dirname);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker });
      if (!origin) return;
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...PUBLIC_PATHS.map((page) => `  <url><loc>${origin}${page}</loc></url>`),
        '</urlset>',
      ];
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: file(sitemap) });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  return {
    plugins: [react(), tailwindcss(), production(env.VITE_SITE_URL, env.VITE_API_URL)],
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
  };
});
