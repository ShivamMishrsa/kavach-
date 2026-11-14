// Writes the public pages out as finished HTML (English, default look), after `vite build`.
//
//   node scripts/prerender.mjs [dist-folder]      (default: dist)
//
// Why: the website is a single-page app, so without this a search engine, a link preview or a
// phone on a slow network gets an empty page until the scripts have run. With it, /privacy is a real
// file with its text in it; the app still takes over in the browser (see src/main.tsx).
// It builds the same code for Node into a cache folder, renders each page in `PUBLIC_PATHS`, and
// puts the result into the built index.html, one file per page (privacy.html for /privacy). Nothing is fetched and no
// browser is needed, so it runs anywhere `vite build` does.
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, loadEnv } from 'vite';

const outDir = path.resolve(process.argv[2] ?? 'dist');
const env = loadEnv('production', process.cwd(), 'VITE_');

if (env.VITE_MAINTENANCE === 'true') {
  console.log('prerender: maintenance build, nothing to write out');
  process.exit(0);
}

const work = path.resolve('node_modules/.cache/kavach-prerender');
await build({
  logLevel: 'error',
  build: { ssr: 'src/entry-server.tsx', outDir: work, emptyOutDir: true, minify: false },
});
const { render, PUBLIC_PATHS } = await import(pathToFileURL(path.join(work, 'entry-server.js')));

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Replaces exactly one match, so a change to index.html that breaks this fails the build. */
function replaceOnce(source, pattern, replacement, what) {
  const found = source.match(new RegExp(pattern, 'g'));
  if (found?.length !== 1) throw new Error(`prerender: expected one ${what} in index.html`);
  return source.replace(pattern, () => replacement);
}

const template = await readFile(path.join(outDir, 'index.html'), 'utf8');
// The same text vite.config.ts hashes into the Content-Security-Policy.
const skip = (await readFile('scripts/skip-prerender.js', 'utf8')).trim();
const site = env.VITE_SITE_URL?.replace(/\/$/, '');

for (const route of PUBLIC_PATHS) {
  const { html, title, description } = await render(route);
  let page = template;
  page = replaceOnce(page, /<div id="root"><\/div>/, `<div id="root">${html}</div>`, 'empty root');
  page = replaceOnce(
    page,
    /<html lang="en">/,
    `<html lang="en" data-prerendered="${route}">`,
    'html tag',
  );
  page = replaceOnce(
    page,
    /<title>[^<]*<\/title>/,
    `<script>${skip}</script>
    <title>${escape(title)}</title>`,
    'title',
  );
  page = replaceOnce(
    page,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${escape(description)}" />`,
    'description',
  );
  page = replaceOnce(
    page,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${escape(title)}" />`,
    'og:title',
  );
  page = replaceOnce(
    page,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${escape(description)}" />`,
    'og:description',
  );
  if (site) {
    page = replaceOnce(
      page,
      /<\/head>/,
      `<link rel="canonical" href="${site}${route === '/' ? '/' : route}" />\n  </head>`,
      'head end',
    );
  }
  // help.html is what hosts serve for /help (Cloudflare Pages, Netlify and `vite preview` all do).
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
  await writeFile(path.join(outDir, file), page);
  console.log(`prerender: ${route} -> ${file} (${Math.round(page.length / 1024)} KB)`);
}

await rm(work, { recursive: true, force: true });
