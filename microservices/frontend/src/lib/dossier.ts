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
 * Values for the text to read to the helpline. Anything missing becomes `fallback`,
 * so the script never contains an empty gap or invented data.
 */
export function scriptValues(
  entities: Entity[],
  formatDate: (value: string) => string,
  fallback: string,
) {
  const get = (type: EntityType) => entityValue(entities, type) ?? fallback;
  const date = entityValue(entities, 'datetime');
  return {
    utr: get('utr'),
    upi: get('upi'),
    amount: get('amount'),
    phone: get('phone'),
    date: date ? formatDate(date) : fallback,
  };
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
