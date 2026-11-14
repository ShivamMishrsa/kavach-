// Draws the app icons (PNG) from the same shield as public/favicon.svg.
//
//   node scripts/make-icons.mjs        (needs Playwright's Chromium: npx playwright install chromium)
//
// The PNGs are committed, so this only needs to run when the icon changes. Then run
// scripts/shrink-icons.py, which cuts their size to a third. Android and iPhone want
// PNGs for the home screen, and a "maskable" one whose picture stays inside the middle 60% because
// the phone may crop it to a circle or a rounded square.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BLUE = '#1d4ed8';
const SHIELD = `
  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
  <path d="m9 12 2 2 4-4"/>`;

/** One icon: `scale` is how much of the square the shield (24 units) covers. */
const icon = (size, { radius, scale }) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius * size}" fill="${BLUE}"/>
    <g transform="translate(${(size - 24 * scale) / 2} ${(size - 24 * scale) / 2}) scale(${scale})"
       fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SHIELD}</g>
  </svg>`;

const ICONS = [
  // name, size, rounded corners (0.22 of the side), how much of the side the 24-unit drawing covers (the shield itself is two thirds of that)
  ['icon-192.png', 192, { radius: 0.22, scale: (192 * 0.88) / 24 }],
  ['icon-512.png', 512, { radius: 0.22, scale: (512 * 0.88) / 24 }],
  ['icon-maskable-512.png', 512, { radius: 0, scale: (512 * 0.66) / 24 }], // filled edge to edge
  ['apple-touch-icon.png', 180, { radius: 0, scale: (180 * 0.84) / 24 }], // iOS rounds it itself
];

const out = path.resolve('public/icons');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, options] of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style>${icon(size, options)}`,
  );
  await writeFile(path.join(out, name), await page.screenshot({ omitBackground: true }));
  console.log(`icons: ${name}`);
}
await browser.close();
