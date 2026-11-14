import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/api/client';
import { createBrowserStorage } from '@/api/mock/storage';
import { CONSENT_KEY, CONSENT_VERSION, newConsent, parseConsent, type Consent } from './consent';

interface ConsentValue {
  consent: Consent | null;
  granted: boolean;
  grant: () => void;
  withdraw: () => void;
}

const storage = createBrowserStorage();
const ConsentContext = createContext<ConsentValue | null>(null);

/** The audit record is best effort: the choice itself is kept on the device either way. */
function report(granted: boolean): void {
  void api.recordConsent(CONSENT_VERSION, granted).catch(() => undefined);
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<Consent | null>(() =>
    parseConsent(storage.getItem(CONSENT_KEY)),
  );

  const value = useMemo<ConsentValue>(
    () => ({
      consent,
      granted: consent !== null,
      grant: () => {
        const next = newConsent();
        storage.setItem(CONSENT_KEY, JSON.stringify(next));
        setConsent(next);
        report(true);
      },
      withdraw: () => {
        storage.removeItem(CONSENT_KEY);
        setConsent(null);
        report(false);
      },
    }),
    [consent],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConsent(): ConsentValue {
  const context = useContext(ConsentContext);
  if (!context) throw new Error('useConsent must be used inside ConsentProvider');
  return context;
}
