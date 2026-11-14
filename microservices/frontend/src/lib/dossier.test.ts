import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { Entity } from '@/api/types';
import { buildScript } from './dossier';

/** Shows the key and the values it was given, so a test can see exactly what was asked for. */
const t = ((key: string, values?: Record<string, string>) =>
  values ? `${key}(${Object.values(values).join(',')})` : key) as unknown as TFunction;
const format = (value: string) => `<${value}>`;

describe('buildScript', () => {
  it('uses every confirmed detail, in the order the helpline asks for them', () => {
    const entities: Entity[] = [
      { type: 'phone', value: '9000000000' },
      { type: 'utr', value: '400000000001' },
      { type: 'upi', value: 'a@upi' },
      { type: 'amount', value: 'Rs 500' },
      { type: 'datetime', value: '12/11/2026' },
    ];
    expect(buildScript(entities, t, format)).toBe(
      [
        'dossier.scriptIntro',
        'dossier.scriptDate(<12/11/2026>)',
        'dossier.scriptAmount(Rs 500)',
        'dossier.scriptUpi(a@upi)',
        'dossier.scriptUtr(400000000001)',
        'dossier.scriptPhone(9000000000)',
        'dossier.scriptClose',
      ].join(' '),
    );
  });

  it('leaves out a detail that was not confirmed instead of printing a gap', () => {
    const script = buildScript([{ type: 'utr', value: '400000000001' }], t, format);
    expect(script).toBe('dossier.scriptIntro dossier.scriptUtr(400000000001) dossier.scriptClose');
  });

  it('still makes a sensible script when nothing was confirmed', () => {
    expect(buildScript([], t, format)).toBe('dossier.scriptIntro dossier.scriptClose');
  });
});
