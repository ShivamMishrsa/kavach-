/**
 * Versioned consent. If the consent text changes, bump CONSENT_VERSION and everyone is asked again.
 * Every grant or withdrawal is also recorded by the backend (version, time, hashed IP address).
 */
export const CONSENT_VERSION = '2026-11-v1';
export const CONSENT_KEY = 'kavach.consent';

export interface Consent {
  version: string;
  grantedAt: string; // ISO 8601
}

export function parseConsent(raw: string | null, version = CONSENT_VERSION): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Consent>;
    if (value.version === version && typeof value.grantedAt === 'string') {
      return { version: value.version, grantedAt: value.grantedAt };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function newConsent(now = new Date()): Consent {
  return { version: CONSENT_VERSION, grantedAt: now.toISOString() };
}
