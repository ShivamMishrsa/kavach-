export type RiskLevel = 'very_high' | 'high' | 'medium' | 'cannot_verify' | 'low';

/** Full literal class names so Tailwind can generate them. */
export const RISK_BG: Record<RiskLevel, string> = {
  very_high: 'bg-risk-very-high',
  high: 'bg-risk-high',
  medium: 'bg-risk-medium',
  cannot_verify: 'bg-risk-unknown',
  low: 'bg-risk-low',
};

export const RISK_BORDER: Record<RiskLevel, string> = {
  very_high: 'border-risk-very-high',
  high: 'border-risk-high',
  medium: 'border-risk-medium',
  cannot_verify: 'border-risk-unknown',
  low: 'border-risk-low',
};

/** Soft card background per level (red tint only for the risky levels). */
export const RISK_SOFT_BG: Record<RiskLevel, string> = {
  very_high: 'bg-danger-bg',
  high: 'bg-danger-bg',
  medium: 'bg-warn-bg',
  cannot_verify: 'bg-chip',
  low: 'bg-ok-bg',
};

/** Position on the four-step bar (null = cannot verify, nothing highlighted). */
export const RISK_BAR_INDEX: Record<RiskLevel, number | null> = {
  low: 0,
  medium: 1,
  high: 2,
  very_high: 3,
  cannot_verify: null,
};

export const BAR_KEYS = ['low', 'medium', 'high', 'very_high'] as const;
