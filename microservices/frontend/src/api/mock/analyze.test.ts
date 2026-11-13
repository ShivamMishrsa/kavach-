import { describe, expect, it } from 'vitest';
import {
  analyzeLink,
  analyzeText,
  extractEntities,
  normalizeUrl,
  sampleResult,
  simulatedUploadResult,
} from './analyze';

const now = new Date('2026-11-13T10:00:00Z');

describe('analyzeText', () => {
  it('flags a digital-arrest message that asks for money as very high', () => {
    const result = analyzeText(
      'You are under digital arrest. Transfer Rs. 50000 to the safe account immediately. Tell no one.',
      now,
    );
    expect(result.riskLevel).toBe('very_high');
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining(['digital_arrest', 'payment_demand', 'safe_account', 'secrecy']),
    );
  });

  it('is high with one strong signal plus a supporting one', () => {
    const result = analyzeText('CBI case registered against you. Reply immediately.', now);
    expect(result.riskLevel).toBe('high');
  });

  it('is medium with only urgency', () => {
    expect(
      analyzeText('Please reply immediately to confirm the delivery slot.', now).riskLevel,
    ).toBe('medium');
  });

  it('is low for an ordinary message', () => {
    expect(analyzeText('Your order will arrive tomorrow between 10 and 12.', now).riskLevel).toBe(
      'low',
    );
  });

  it('cannot verify very short text', () => {
    expect(analyzeText('hi', now)).toEqual({
      riskLevel: 'cannot_verify',
      reasonCodes: [],
      entities: [],
    });
  });

  it('notes an outdated law section', () => {
    expect(
      analyzeText('Case under IPC section 420 will be filed against you', now).reasonCodes,
    ).toContain('outdated_section');
  });
});

describe('extractEntities', () => {
  it('finds UTR, UPI id, phone, amount and link', () => {
    const entities = extractEntities(
      'Paid ₹50,000, UTR 412345678901 to ram@okaxis. Call +91 98765 43210 or open https://x.example/pay',
      now,
    );
    const byType = Object.fromEntries(entities.map((e) => [e.type, e.value]));
    expect(byType.utr).toBe('412345678901');
    expect(byType.upi).toBe('ram@okaxis');
    expect(byType.phone).toContain('98765 43210');
    expect(byType.amount).toBe('₹50,000');
    expect(byType.link).toBe('https://x.example/pay');
    expect(byType.datetime).toBe(now.toISOString());
  });

  it('returns nothing when there is nothing to extract', () => {
    expect(extractEntities('hello there', now)).toEqual([]);
  });
});

describe('normalizeUrl', () => {
  it('adds https when missing', () => {
    expect(normalizeUrl('sbi.co.in')?.protocol).toBe('https:');
  });

  it('rejects things that are not web addresses', () => {
    for (const bad of ['', 'hello', 'a b.com', 'ftp://files.example.com', 'javascript:alert(1)']) {
      expect(normalizeUrl(bad), bad).toBeNull();
    }
  });
});

describe('analyzeLink', () => {
  it('is low for an official bank domain', () => {
    expect(analyzeLink('https://www.sbi.co.in/web/personal-banking')?.riskLevel).toBe('low');
  });

  it('is very high for a look-alike domain without https', () => {
    expect(analyzeLink('http://sbi-kyc-update.example/verify')?.riskLevel).toBe('very_high');
  });

  it('is high for a look-alike domain with https', () => {
    const result = analyzeLink('https://paytm.com.fake-site.in/pay');
    expect(result?.riskLevel).toBe('high');
    expect(result?.reasonCodes).toContain('lookalike_domain');
  });

  it('spots digit-for-letter tricks', () => {
    expect(analyzeLink('https://5bi-login.in')?.reasonCodes).toContain('lookalike_domain');
  });

  it('spots punycode domains', () => {
    expect(analyzeLink('https://xn--sbi-9ra.com')?.reasonCodes).toContain('lookalike_domain');
  });

  it('is medium for plain http to an unknown site', () => {
    expect(analyzeLink('http://example.org')?.riskLevel).toBe('medium');
  });

  it('cannot verify an unknown https site', () => {
    expect(analyzeLink('https://example.org')?.riskLevel).toBe('cannot_verify');
  });

  it('returns null for an invalid address', () => {
    expect(analyzeLink('not a link')).toBeNull();
  });
});

describe('demo samples', () => {
  it('gives each sample its intended level', () => {
    expect(sampleResult('fake_notice', now).riskLevel).toBe('very_high');
    expect(sampleResult('courier_link', now).riskLevel).toBe('high');
    expect(sampleResult('medium_message', now).riskLevel).toBe('medium');
    expect(sampleResult('unclear_photo', now).riskLevel).toBe('cannot_verify');
    expect(sampleResult('bank_alert', now).riskLevel).toBe('low');
  });

  it('the fake notice sample has the details a dossier needs', () => {
    const types = sampleResult('fake_notice', now).entities.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['utr', 'upi', 'phone', 'amount', 'datetime']));
  });

  it('simulated upload results are deterministic per hash', () => {
    expect(simulatedUploadResult('00aa', now)).toEqual(simulatedUploadResult('00aa', now));
    expect(simulatedUploadResult('00aa', now).riskLevel).toBe('very_high');
    expect(simulatedUploadResult('04aa', now).riskLevel).toBe('low');
  });
});
