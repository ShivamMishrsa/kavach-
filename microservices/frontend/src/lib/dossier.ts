import type { TFunction } from 'i18next';
import type { Entity, EntityType } from '@/api/types';

export const ENTITY_ORDER: EntityType[] = ['utr', 'upi', 'amount', 'datetime', 'phone', 'link'];

export function entityValue(entities: Entity[], type: EntityType): string | undefined {
  return entities.find((entity) => entity.type === type)?.value;
}

/** Details in a fixed, readable order (UTR first, because that is what the helpline asks for). */
export function sortEntities(entities: Entity[]): Entity[] {
  return [...entities].sort((a, b) => ENTITY_ORDER.indexOf(a.type) - ENTITY_ORDER.indexOf(b.type));
}

/** Types the person could still add by hand. */
export function missingTypes(entities: Entity[]): EntityType[] {
  return ENTITY_ORDER.filter((type) => !entities.some((entity) => entity.type === type));
}

/**
 * The text to read to the helpline: one short sentence for each detail the person confirmed.
 * A detail that is missing is left out, so the script never has a gap or invented data.
 */
export function buildScript(
  entities: Entity[],
  t: TFunction,
  formatDate: (value: string) => string,
): string {
  const value = (type: EntityType) => entityValue(entities, type);
  const date = value('datetime');
  const sentences = [
    t('dossier.scriptIntro'),
    date && t('dossier.scriptDate', { date: formatDate(date) }),
    value('amount') && t('dossier.scriptAmount', { amount: value('amount') }),
    value('upi') && t('dossier.scriptUpi', { upi: value('upi') }),
    value('utr') && t('dossier.scriptUtr', { utr: value('utr') }),
    value('phone') && t('dossier.scriptPhone', { phone: value('phone') }),
    t('dossier.scriptClose'),
  ];
  return sentences.filter(Boolean).join(' ');
}

export interface DossierTextInput {
  title: string;
  disclaimer: string;
  summaryTitle: string;
  summary: string;
  detailsTitle: string;
  details: { label: string; value: string }[];
  evidenceTitle: string;
  evidence: { name: string; sha256: string; capturedAt: string }[];
  scriptTitle: string;
  script: string;
}

/** Plain-text version of the evidence summary, for copying into a complaint form or message. */
export function buildDossierText(input: DossierTextInput): string {
  const lines: string[] = [input.title, input.disclaimer, '', input.summaryTitle, input.summary];
  if (input.details.length > 0) {
    lines.push('', input.detailsTitle, ...input.details.map((d) => `${d.label}: ${d.value}`));
  }
  if (input.evidence.length > 0) {
    lines.push(
      '',
      input.evidenceTitle,
      ...input.evidence.map((e) => `${e.name} | SHA-256 ${e.sha256} | ${e.capturedAt}`),
    );
  }
  lines.push('', input.scriptTitle, input.script);
  return lines.join('\n');
}
