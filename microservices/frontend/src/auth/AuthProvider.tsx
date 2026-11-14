import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import i18n, { isLanguage } from '@/i18n';
import { api, isMockApi } from '@/api/client';
import { createBrowserStorage } from '@/api/mock/storage';
import type { Account, AccountPatch } from '@/api/types';
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
  /** The signed-in account (real backend only). */
  account: Account | null;
  /** True once the person has chosen a language after signing in or continuing as guest. */
  onboarded: boolean;
  /** False only while the first look for a signed-in account is running (real backend only). */
  ready: boolean;
  /** Returns where to go next: the app if a guest is already set up, otherwise the language screen. */
  continueAsGuest: () => Destination;
  /** Demo only: pretends to sign in. The real backend uses requestLink and completeSignIn. */
  signIn: (email: string) => Destination;
  /** Emails a one-time sign-in link. */
  requestLink: (email: string) => Promise<void>;
  /** Uses the secret from the emailed link and returns where to go next. */
  completeSignIn: (token: string) => Promise<Destination>;
  updateAccount: (patch: AccountPatch) => Promise<void>;
  /** Sends a link to the new address. The address changes when it is opened. */
  requestEmailChange: (email: string) => Promise<void>;
  /** Uses the secret from that link. */
  confirmEmailChange: (token: string) => Promise<void>;
  completeOnboarding: () => void;
  signOut: (everywhere?: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const storage = createBrowserStorage();
const AuthContext = createContext<AuthValue | null>(null);

/** With the real backend the cookie is the proof of an account; only a guest is remembered here. */
function loadSession(): Session | null {
  const saved = parseSession(storage.getItem(SESSION_KEY));
  return isMockApi || saved?.kind === 'guest' ? saved : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(isMockApi);
  const [onboarded, setOnboarded] = useState<boolean>(() => storage.getItem(ONBOARDED_KEY) === '1');

  const store = useCallback((next: Session | null) => {
    setSession(next);
    if (next && (next.kind === 'guest' || isMockApi)) {
      storage.setItem(SESSION_KEY, JSON.stringify(next));
    } else {
      storage.removeItem(SESSION_KEY);
    }
  }, []);

  const setOnboardedFlag = useCallback((value: boolean) => {
    setOnboarded(value);
    if (value) storage.setItem(ONBOARDED_KEY, '1');
    else storage.removeItem(ONBOARDED_KEY);
  }, []);

  const forgetEverything = useCallback(() => {
    store(null);
    setAccount(null);
    setOnboardedFlag(false);
  }, [store, setOnboardedFlag]);

  /** Starts a signed-in session for an account the server has confirmed. */
  const acceptAccount = useCallback(
    async (found: Account, wasGuestReady: boolean): Promise<Destination> => {
      const savedValid = isLanguage(found.language);
      const outcome = signInOutcome(wasGuestReady, savedValid);
      let current = found;
      if (outcome.adoptSavedLanguage && isLanguage(found.language)) {
        await i18n.changeLanguage(found.language);
      }
      if (outcome.saveCurrentLanguage) {
        current = await api.updateAccount({ language: i18n.language });
      }
      store({ kind: 'user', email: current.email });
      setAccount(current);
      setOnboardedFlag(outcome.onboarded);
      return outcome.destination;
    },
    [store, setOnboardedFlag],
  );

  // Real backend: find out at start whether a session cookie belongs to an account.
  useEffect(() => {
    if (isMockApi) return;
    const wasGuestReady = loadSession()?.kind === 'guest' && storage.getItem(ONBOARDED_KEY) === '1';
    api
      .getAccount()
      .then((found) => (found ? acceptAccount(found, wasGuestReady) : undefined))
      .catch(() => undefined) // offline: carry on as before; the next request will say more
      .finally(() => setReady(true));
  }, [acceptAccount]);

  // The chosen language follows the account: in the server account, or (demo) a local profile.
  useEffect(() => {
    if (session?.kind !== 'user') return;
    const email = session.email;
    const save = (language: string) => {
      if (isMockApi) writeProfileLanguage(storage, email, language);
      else if (isLanguage(language) && language !== account?.language) {
        api
          .updateAccount({ language })
          .then(setAccount)
          .catch(() => undefined);
      }
    };
    i18n.on('languageChanged', save);
    return () => i18n.off('languageChanged', save);
  }, [session, account?.language]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      account,
      onboarded,
      ready,
      continueAsGuest: () => {
        if (session?.kind === 'guest' && onboarded) return '/app';
        store({ kind: 'guest' });
        setOnboardedFlag(false);
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
        setOnboardedFlag(outcome.onboarded);
        return outcome.destination;
      },
      requestLink: (email) => api.requestSignInLink(email.trim(), i18n.language),
      completeSignIn: async (token) =>
        acceptAccount(await api.verifySignIn(token), session?.kind === 'guest' && onboarded),
      updateAccount: async (patch) => setAccount(await api.updateAccount(patch)),
      requestEmailChange: (email) => api.requestEmailChange(email.trim(), i18n.language),
      confirmEmailChange: async (token) => {
        const changed = await api.confirmEmailChange(token);
        setAccount(changed);
        store({ kind: 'user', email: changed.email });
      },
      completeOnboarding: () => {
        setOnboardedFlag(true);
        if (session?.kind !== 'user') return;
        if (isMockApi) writeProfileLanguage(storage, session.email, i18n.language);
        else void api.updateAccount({ language: i18n.language }).then(setAccount);
      },
      signOut: async (everywhere = false) => {
        if (!isMockApi) await api.signOut(everywhere);
        forgetEverything();
      },
      deleteAccount: async () => {
        if (isMockApi && session?.kind === 'user') deleteProfile(storage, session.email);
        if (!isMockApi) await api.deleteAccount();
        forgetEverything();
      },
    }),
    [session, account, onboarded, ready, store, setOnboardedFlag, forgetEverything, acceptAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
