import type { KeyValueStorage } from '@/api/mock/storage';

/**
 * Session handling for the demo (real sign-in comes in Step 7).
 * A guest has no account; a user has an email. Language is kept in the browser for guests
 * and in a per-account profile for users.
 */
export type Session = { kind: 'guest' } | { kind: 'user'; email: string };

export const SESSION_KEY = 'kavach.session';
export const ONBOARDED_KEY = 'kavach.onboarded';
const PROFILE_PREFIX = 'kavach.profile.';

export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { kind?: unknown; email?: unknown };
    if (value.kind === 'guest') return { kind: 'guest' };
    if (value.kind === 'user' && typeof value.email === 'string' && validateEmail(value.email)) {
      return { kind: 'user', email: value.email };
    }
  } catch {
    /* fall through */
  }
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function readProfileLanguage(storage: KeyValueStorage, email: string): string | null {
  try {
    const profile = JSON.parse(storage.getItem(PROFILE_PREFIX + email.toLowerCase()) ?? 'null') as {
      language?: unknown;
    } | null;
    return typeof profile?.language === 'string' ? profile.language : null;
  } catch {
    return null;
  }
}

export function writeProfileLanguage(
  storage: KeyValueStorage,
  email: string,
  language: string,
): void {
  storage.setItem(PROFILE_PREFIX + email.toLowerCase(), JSON.stringify({ language }));
}

export function deleteProfile(storage: KeyValueStorage, email: string): void {
  storage.removeItem(PROFILE_PREFIX + email.toLowerCase());
}

export type Destination = '/app' | '/language';

export interface SignInOutcome {
  destination: Destination;
  /** True when the person can go straight into the app (their language is already known). */
  onboarded: boolean;
  /** Use the language saved in the account profile. */
  adoptSavedLanguage: boolean;
  /** A guest who signs up keeps the language they already chose. */
  saveCurrentLanguage: boolean;
}

/**
 * Decides what happens after sign-in:
 * - an account with a saved language goes straight to the app in that language;
 * - a guest who already chose a language keeps it and goes straight to the app;
 * - anyone else is asked to choose a language first.
 */
export function signInOutcome(wasGuestReady: boolean, hasSavedLanguage: boolean): SignInOutcome {
  if (hasSavedLanguage) {
    return {
      destination: '/app',
      onboarded: true,
      adoptSavedLanguage: true,
      saveCurrentLanguage: false,
    };
  }
  if (wasGuestReady) {
    return {
      destination: '/app',
      onboarded: true,
      adoptSavedLanguage: false,
      saveCurrentLanguage: true,
    };
  }
  return {
    destination: '/language',
    onboarded: false,
    adoptSavedLanguage: false,
    saveCurrentLanguage: false,
  };
}
