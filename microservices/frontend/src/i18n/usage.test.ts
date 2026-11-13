/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';

/**
 * Safety net: every translation key used in the code must exist in en.json,
 * so a screen can never show a raw key like "dossier.title" to a user.
 */

const SRC = path.resolve(import.meta.dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

function resolve(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      en,
    );
}

const namespaces = new Set(Object.keys(en));
const files = sourceFiles(SRC).map((file) => ({ file, text: readFileSync(file, 'utf8') }));

describe('translation keys used in the code', () => {
  it('every literal key exists in en.json', () => {
    const missing: string[] = [];
    const literal = /(['"`])([a-z][A-Za-z]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+)\1/g;
    for (const { file, text } of files) {
      // The mock backend contains file names such as "link.txt", not translation keys.
      if (file.includes(`${path.sep}api${path.sep}`)) continue;
      for (const match of text.matchAll(literal)) {
        const key = match[2];
        if (!namespaces.has(key.split('.')[0])) continue;
        if (resolve(key) === undefined) missing.push(`${path.relative(SRC, file)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every dynamic key prefix points to a group in en.json', () => {
    const missing: string[] = [];
    const dynamic = /\bt\(\s*`([^`$]*)\$\{/g;
    for (const { file, text } of files) {
      for (const match of text.matchAll(dynamic)) {
        const prefix = match[1];
        if (!prefix.endsWith('.')) continue;
        const group = resolve(prefix.slice(0, -1));
        if (!group || typeof group === 'string') {
          missing.push(`${path.relative(SRC, file)}: ${prefix}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('found a sensible number of keys (the scan itself works)', () => {
    const count = files.reduce((n, { text }) => n + (text.match(/\bt\(/g)?.length ?? 0), 0);
    expect(count).toBeGreaterThan(100);
  });
});
