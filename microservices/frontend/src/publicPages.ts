/**
 * The pages anyone can open without signing in. They are the ones written out as finished HTML at
 * build time (scripts/prerender.mjs) and listed in sitemap.xml. A test checks that each of them is
 * a public route, so a page cannot be added to one place and forgotten in another.
 */
export const PUBLIC_PATHS = ['/', '/help', '/emergency', '/privacy', '/terms', '/limitations'];
