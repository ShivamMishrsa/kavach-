import { describe, expect, it } from 'vitest';
import {
  BAR_KEYS,
  RISK_BAR_INDEX,
  RISK_BG,
  RISK_BORDER,
  RISK_SOFT_BG,
  type RiskLevel,
} from './risk';

const LEVELS: RiskLevel[] = ['very_high', 'high', 'medium', 'cannot_verify', 'low'];

describe('risk levels', () => {
  it('has a colour class for every level', () => {
    for (const level of LEVELS) {
      expect(RISK_BG[level]).toMatch(/^bg-risk-/);
      expect(RISK_BORDER[level]).toMatch(/^border-risk-/);
      expect(RISK_SOFT_BG[level]).toMatch(/^bg-/);
    }
  });

  it('only tints the card red for the risky levels', () => {
    expect(RISK_SOFT_BG.very_high).toBe('bg-danger-bg');
    expect(RISK_SOFT_BG.high).toBe('bg-danger-bg');
    expect(RISK_SOFT_BG.low).not.toBe('bg-danger-bg');
    expect(RISK_SOFT_BG.medium).not.toBe('bg-danger-bg');
  });

  it('highlights nothing on the bar when the result cannot be verified', () => {
    expect(RISK_BAR_INDEX.cannot_verify).toBeNull();
  });

  it('orders the bar from low to very high', () => {
    expect(BAR_KEYS).toEqual(['low', 'medium', 'high', 'very_high']);
    expect(RISK_BAR_INDEX.low).toBe(0);
    expect(RISK_BAR_INDEX.very_high).toBe(3);
  });
});
