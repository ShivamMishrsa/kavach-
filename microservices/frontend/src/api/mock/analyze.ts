import type { RiskLevel } from '@/components/ui/risk';
import type { Entity, ReasonCode, SampleId, ScanResult } from '../types';

/**
 * SIMPLIFIED stand-in for the real detection (Step 4). It exists so the screens can be built
 * and demonstrated; every result produced here is marked `simulated` and shown as demo mode.
 */

// ---------- text ----------

const STRONG: [ReasonCode, RegExp][] = [
  [
    'digital_arrest',
    /digital arrest|arrest warrant|warrant|custody|narcotic|money laundering|\bcbi\b|\bnarcotics\b/i,
  ],
  [
    'payment_demand',
    /(transfer|send|pay|deposit)[^.\n]{0,60}(₹|rs\.?|rupees|inr|\d{4,}|account)|(₹|rs\.?|inr)\s?[\d,]{4,}/i,
  ],
  ['safe_account', /safe account|verification account|secure account|rbi account|escrow account/i],
];

const SUPPORTING: [ReasonCode, RegExp][] = [
  [
    'secrecy',
    /don'?t tell|do not tell|tell no one|tell nobody|keep (this )?(secret|confidential)/i,
  ],
  ['urgency', /immediately|urgent|right now|within \d+ ?(min|hour)|last warning/i],
  ['outdated_section', /\bIPC\b|indian penal code/i],
];

export function extractEntities(text: string, now: Date): Entity[] {
  const found: Entity[] = [];
  const add = (type: Entity['type'], value: string | undefined) => {
    if (value && !found.some((e) => e.type === type && e.value === value))
      found.push({ type, value });
  };
  add('utr', text.match(/\b\d{12}\b/)?.[0]);
  add('upi', text.match(/\b[\w.-]{2,}@[a-z]{2,}\b/i)?.[0]);
  add('phone', text.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/)?.[0]);
  // The amount must end on a digit so a sentence comma is not captured ("₹50,000," -> "₹50,000").
  add('amount', text.match(/(?:₹|rs\.?\s?|inr\s?)\s?\d(?:[\d,]*\d)?/i)?.[0]?.trim());
  add('link', text.match(/https?:\/\/\S+/i)?.[0]);
  if (found.length > 0) add('datetime', now.toISOString());
  return found;
}

export function analyzeText(text: string, now: Date): ScanResult {
  const trimmed = text.trim();
  if (trimmed.length < 8) {
    return { riskLevel: 'cannot_verify', reasonCodes: [], entities: [], statutes: [] };
  }
  const strong = STRONG.filter(([, pattern]) => pattern.test(trimmed)).map(([code]) => code);
  const supporting = SUPPORTING.filter(([, pattern]) => pattern.test(trimmed)).map(
    ([code]) => code,
  );

  let riskLevel: RiskLevel = 'low';
  if (strong.length >= 2) riskLevel = 'very_high';
  else if (strong.length === 1 && supporting.length >= 1) riskLevel = 'high';
  else if (strong.length === 1 || supporting.length >= 1) riskLevel = 'medium';

  return {
    riskLevel,
    reasonCodes: [...strong, ...supporting],
    entities: extractEntities(trimmed, now),
    statutes: [],
  };
}

// ---------- links ----------

const OFFICIAL_HOSTS = [
  'onlinesbi.sbi',
  'sbi.co.in',
  'hdfcbank.com',
  'icicibank.com',
  'axisbank.com',
  'paytm.com',
  'phonepe.com',
  'npci.org.in',
  'rbi.org.in',
  'cbi.gov.in',
  'incometax.gov.in',
  'cybercrime.gov.in',
];
const BRANDS = [
  'sbi',
  'hdfc',
  'icici',
  'axis',
  'paytm',
  'phonepe',
  'npci',
  'rbi',
  'cbi',
  'incometax',
];

export function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url;
  } catch {
    return null;
  }
}

function isOfficial(host: string): boolean {
  return (
    host.endsWith('.gov.in') ||
    OFFICIAL_HOSTS.some((official) => host === official || host.endsWith(`.${official}`))
  );
}

function looksLikeBrand(host: string): boolean {
  const flattened = host
    .replace(/[-_.]/g, '')
    .replace(/0/g, 'o')
    .replace(/[1|]/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's');
  return BRANDS.some((brand) => flattened.includes(brand));
}

export function analyzeLink(input: string): ScanResult | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const reasons: ReasonCode[] = [];

  // The URL parser turns non-Latin look-alike characters into 'xn--' (punycode).
  const hasSpoofShape = host.includes('xn--');
  if (hasSpoofShape || (looksLikeBrand(host) && !isOfficial(host)))
    reasons.push('lookalike_domain');
  if (url.protocol === 'http:') reasons.push('insecure_link');

  const entities: Entity[] = [{ type: 'link', value: url.toString() }];
  let riskLevel: RiskLevel;
  if (reasons.length >= 2) riskLevel = 'very_high';
  else if (reasons.includes('lookalike_domain')) riskLevel = 'high';
  else if (reasons.length === 1) riskLevel = 'medium';
  else if (isOfficial(host)) riskLevel = 'low';
  else riskLevel = 'cannot_verify';

  return { riskLevel, reasonCodes: reasons, entities, statutes: [] };
}

// ---------- demo samples and simulated uploads ----------

export function sampleResult(sample: SampleId, now: Date): ScanResult {
  const earlier = new Date(now.getTime() - 20 * 60_000).toISOString();
  switch (sample) {
    case 'fake_notice':
      return {
        riskLevel: 'very_high',
        reasonCodes: [
          'digital_arrest',
          'payment_demand',
          'safe_account',
          'secrecy',
          'outdated_section',
        ],
        entities: [
          { type: 'utr', value: '400000000001' },
          { type: 'upi', value: 'safe.verification@upi' },
          { type: 'phone', value: '+91 90000 00000' },
          { type: 'amount', value: '₹50,000' },
          { type: 'datetime', value: earlier },
        ],
        statutes: [{ cited: 'IPC 420', current: 'BNS 318(4)' }],
      };
    case 'courier_link':
      return {
        riskLevel: 'high',
        reasonCodes: ['urgency', 'lookalike_domain'],
        entities: [{ type: 'link', value: 'http://sbi-kyc-update.example/verify' }],
        statutes: [],
      };
    case 'medium_message':
      return { riskLevel: 'medium', reasonCodes: ['urgency'], entities: [], statutes: [] };
    case 'unclear_photo':
      return { riskLevel: 'cannot_verify', reasonCodes: [], entities: [], statutes: [] };
    case 'bank_alert':
      return { riskLevel: 'low', reasonCodes: [], entities: [], statutes: [] };
  }
}

const UPLOAD_CYCLE: SampleId[] = [
  'fake_notice',
  'courier_link',
  'medium_message',
  'unclear_photo',
  'bank_alert',
];

/** Picks a demo outcome from the first byte of the file hash. NOT real detection. */
export function simulatedUploadResult(sha256Hex: string, now: Date): ScanResult {
  const index = parseInt(sha256Hex.slice(0, 2), 16) % UPLOAD_CYCLE.length;
  return sampleResult(UPLOAD_CYCLE[index], now);
}
