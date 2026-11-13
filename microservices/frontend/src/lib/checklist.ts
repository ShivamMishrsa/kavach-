export const SENT_MONEY_KEY = 'kavach.sentmoney';

export const SENT_MONEY_STEPS = ['call', 'report', 'bank', 'evidence', 'keep', 'nomore'] as const;
export type SentMoneyStep = (typeof SENT_MONEY_STEPS)[number];

/** Reads the saved ticks and ignores anything that is not a known step. */
export function parseChecked(raw: string | null): SentMoneyStep[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return SENT_MONEY_STEPS.filter((step) => value.includes(step));
  } catch {
    return [];
  }
}

export function toggleStep(current: SentMoneyStep[], step: SentMoneyStep): SentMoneyStep[] {
  const next = current.includes(step)
    ? current.filter((item) => item !== step)
    : [...current, step];
  return SENT_MONEY_STEPS.filter((item) => next.includes(item));
}
