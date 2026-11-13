import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import i18n, { isLanguage } from '@/i18n';
import { createBrowserStorage } from '@/api/mock/storage';
import {
  ONBOARDED_KEY,
  SESSION_KEY,
  deleteProfile,
  parseSession,
  readProfileLanguage,
  signInOutcome,
  writeProfileLanguage,
  type Destination,
  type Session,
} from './session';

interface AuthValue {
  session: Session | null;
  /** True once the person has chosen a language after signing in or continuing as guest. */
  onboarded: boolean;
  /** Returns where to go next: the app if a guest is already set up, otherwise the language screen. */
  continueAsGuest: () => Destination;
  /** Demo sign-in: no real email is sent. Real auth replaces this in Step 7. */
  signIn: (email: string) => Destination;
  completeOnboarding: () => void;
  signOut: () => void;
  deleteAccount: () => void;
}

const storage = createBrowserStorage();
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() =>
    parseSession(storage.getItem(SESSION_KEY)),
  );
  const [onboarded, setOnboarded] = useState<boolean>(() => storage.getItem(ONBOARDED_KEY) === '1');

  const store = useCallback((next: Session | null) => {
    setSession(next);
    if (next) storage.setItem(SESSION_KEY, JSON.stringify(next));
    else storage.removeItem(SESSION_KEY);
  }, []);

  // Accounts keep the chosen language in their profile; guests keep it in the browser only.
  useEffect(() => {
    if (session?.kind !== 'user') return;
    const email = session.email;
    const save = (language: string) => writeProfileLanguage(storage, email, language);
    i18n.on('languageChanged', save);
    return () => i18n.off('languageChanged', save);
  }, [session]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      onboarded,
      continueAsGuest: () => {
        if (session?.kind === 'guest' && onboarded) return '/app';
        store({ kind: 'guest' });
        setOnboarded(false);
        storage.removeItem(ONBOARDED_KEY);
        return '/language';
      },
      signIn: (email) => {
        const clean = email.trim().toLowerCase();
        const saved = readProfileLanguage(storage, clean);
        const savedValid = isLanguage(saved);
        const outcome = signInOutcome(session?.kind === 'guest' && onboarded, savedValid);
        store({ kind: 'user', email: clean });
        if (outcome.adoptSavedLanguage && savedValid) void i18n.changeLanguage(saved);
        if (outcome.saveCurrentLanguage) writeProfileLanguage(storage, clean, i18n.language);
        setOnboarded(outcome.onboarded);
        if (outcome.onboarded) storage.setItem(ONBOARDED_KEY, '1');
        else storage.removeItem(ONBOARDED_KEY);
        return outcome.destination;
      },
      completeOnboarding: () => {
        setOnboarded(true);
        storage.setItem(ONBOARDED_KEY, '1');
        if (session?.kind === 'user') writeProfileLanguage(storage, session.email, i18n.language);
      },
      signOut: () => {
        store(null);
        setOnboarded(false);
        storage.removeItem(ONBOARDED_KEY);
      },
      deleteAccount: () => {
        if (session?.kind === 'user') deleteProfile(storage, session.email);
        store(null);
        setOnboarded(false);
        storage.removeItem(ONBOARDED_KEY);
      },
    }),
    [session, onboarded, store],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
