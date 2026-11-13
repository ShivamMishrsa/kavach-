// Checks WCAG contrast (4.5:1) for the colour pairs the UI actually uses,
// in light, dark and both high-contrast modes. Reads src/styles/tokens.css.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(dir, '../src/styles/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

const blocks = {};
for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const vars = {};
  for (const decl of match[2].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    vars[decl[1]] = decl[2];
  }
  blocks[match[1].trim()] = vars;
}

const root = blocks[':root'];
const dark = blocks["[data-theme='dark']"];
const hc = blocks["[data-contrast='high']"];
const hcDark = blocks["[data-contrast='high'][data-theme='dark']"];

const modes = {
  light: { ...root },
  dark: { ...root, ...dark },
  'light + high contrast': { ...root, ...hc },
  'dark + high contrast': { ...root, ...dark, ...hc, ...hcDark },
};

// [foreground, background]
const pairs = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'chip'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['primary', 'chip'],
  ['on-primary', 'primary'],
  ['danger', 'danger-bg'],
  ['ok', 'ok-bg'],
  ['warn', 'warn-bg'],
  ['warn', 'surface'],
  ['warn', 'chip'],
  ['danger', 'surface'],
  ['on-risk', 'risk-very-high'],
  ['on-risk', 'risk-high'],
  ['on-risk', 'risk-medium'],
  ['on-risk', 'risk-unknown'],
  ['on-risk', 'risk-low'],
  ['on-risk', 'danger'],
  ['on-risk', 'ok'],
];

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let failures = 0;
for (const [mode, vars] of Object.entries(modes)) {
  for (const [fg, bg] of pairs) {
    const value = ratio(vars[fg], vars[bg]);
    if (value < 4.5) {
      failures += 1;
      console.log(`FAIL [${mode}] ${fg} on ${bg}: ${value.toFixed(2)}`);
    }
  }
  console.log(`checked ${mode}`);
}

if (failures > 0) {
  console.log(`\n${failures} pair(s) below 4.5:1`);
  process.exit(1);
}
console.log('\nAll pairs meet 4.5:1');
