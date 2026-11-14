import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const PUBLIC_PAGES = ['/', '/help', '/emergency', '/privacy', '/terms', '/limitations'];

/**
 * Writes robots.txt (the app itself is not for search engines) and, when VITE_SITE_URL is set,
 * a sitemap of the public pages. Without the real address no sitemap is written.
 */
function seoFiles(siteUrl: string | undefined): Plugin {
  const origin = siteUrl?.replace(/\/$/, '');
  const file = (lines: string[]) => `${lines.join('\n')}\n`;
  return {
    name: 'kavach-seo-files',
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /app', 'Disallow: /design'];
      if (origin) robots.push(`Sitemap: ${origin}/sitemap.xml`);
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: file(robots) });
      if (!origin) return;
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...PUBLIC_PAGES.map((page) => `  <url><loc>${origin}${page}</loc></url>`),
        '</urlset>',
      ];
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: file(sitemap) });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    seoFiles(loadEnv(mode, import.meta.dirname, 'VITE_').VITE_SITE_URL),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
}));
