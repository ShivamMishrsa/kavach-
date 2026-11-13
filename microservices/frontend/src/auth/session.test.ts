import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '@/api/mock/storage';
import { CONSENT_VERSION, newConsent, parseConsent } from '@/consent/consent';
import {
  deleteProfile,
  parseSession,
  readProfileLanguage,
  signInOutcome,
  validateEmail,
  writeProfileLanguage,
} from './session';

describe('validateEmail', () => {
  it('accepts normal addresses', () => {
    for (const ok of ['a@b.co', 'ravi.kumar@example.com', ' me@site.in ']) {
      expect(validateEmail(ok), ok).toBe(true);
    }
  });

  it('rejects broken addresses', () => {
    for (const bad of ['', 'plain', 'a@b', 'a b@c.com', '@x.com', 'a@.com']) {
      expect(validateEmail(bad), bad).toBe(false);
    }
  });
});

describe('parseSession', () => {
  it('reads a guest and a user', () => {
    expect(parseSession('{"kind":"guest"}')).toEqual({ kind: 'guest' });
    expect(parseSession('{"kind":"user","email":"a@b.co"}')).toEqual({
      kind: 'user',
      email: 'a@b.co',
    });
  });

  it('ignores broken or tampered data', () => {
    for (const bad of [
      null,
      '',
      'nope',
      '{"kind":"admin"}',
      '{"kind":"user"}',
      '{"kind":"user","email":"x"}',
    ]) {
      expect(parseSession(bad), String(bad)).toBeNull();
    }
  });
});

describe('profile language', () => {
  it('is stored per account and removed on delete', () => {
    const storage = createMemoryStorage();
    writeProfileLanguage(storage, 'A@B.co', 'ta');
    expect(readProfileLanguage(storage, 'a@b.co')).toBe('ta');
    expect(readProfileLanguage(storage, 'other@b.co')).toBeNull();
    deleteProfile(storage, 'a@b.co');
    expect(readProfileLanguage(storage, 'a@b.co')).toBeNull();
  });
});

describe('consent', () => {
  it('round-trips the current version', () => {
    const consent = newConsent(new Date('2026-11-13T10:00:00Z'));
    expect(parseConsent(JSON.stringify(consent))).toEqual(consent);
  });

  it('is ignored when the consent text version changed', () => {
    const old = JSON.stringify({ version: 'old', grantedAt: '2026-01-01T00:00:00Z' });
    expect(parseConsent(old)).toBeNull();
    expect(parseConsent(old, 'old')).not.toBeNull();
  });

  it('is ignored when data is broken', () => {
    expect(parseConsent('garbage')).toBeNull();
    expect(parseConsent(null)).toBeNull();
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });
});

describe('signInOutcome', () => {
  it('an account with a saved language goes straight to the app in that language', () => {
    expect(signInOutcome(false, true)).toEqual({
      destination: '/app',
      onboarded: true,
      adoptSavedLanguage: true,
      saveCurrentLanguage: false,
    });
  });

  it('a guest who already chose a language keeps it after signing up', () => {
    expect(signInOutcome(true, false)).toEqual({
      destination: '/app',
      onboarded: true,
      adoptSavedLanguage: false,
      saveCurrentLanguage: true,
    });
  });

  it('a new person is asked to choose a language first', () => {
    expect(signInOutcome(false, false)).toEqual({
      destination: '/language',
      onboarded: false,
      adoptSavedLanguage: false,
      saveCurrentLanguage: false,
    });
  });

  it('a saved account language wins over the guest language', () => {
    expect(signInOutcome(true, true).adoptSavedLanguage).toBe(true);
  });
});
