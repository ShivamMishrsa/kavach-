import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { createBrowserStorage } from '@/api/mock/storage';
import { CONSENT_KEY, newConsent, parseConsent, type Consent } from './consent';

interface ConsentValue {
  consent: Consent | null;
  granted: boolean;
  grant: () => void;
  withdraw: () => void;
}

const storage = createBrowserStorage();
const ConsentContext = createContext<ConsentValue | null>(null);

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
      },
      withdraw: () => {
        storage.removeItem(CONSENT_KEY);
        setConsent(null);
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
