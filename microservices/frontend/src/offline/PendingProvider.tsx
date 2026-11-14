import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useCreateScan } from '@/api/queries';
import { useConsent } from '@/consent/ConsentProvider';
import { useOnline } from '@/pwa/useOnline';
import {
  createBrowserStore,
  freshChecks,
  saveCheck,
  sendCheck,
  type PendingCheck,
  type PendingInput,
} from './queue';

interface PendingValue {
  checks: PendingCheck[];
  /** Keeps a check for when there is a connection. False when there are too many already. */
  saveForLater: (input: PendingInput) => Promise<boolean>;
  /** Tries now. Returns false if it could not be sent yet. */
  sendNow: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

const PendingContext = createContext<PendingValue | null>(null);

/**
 * Holds the checks saved for later and sends them when the connection returns, but only while the
 * app is open. Lives inside the router (a finished check offers a button that opens its result).
 */
export function PendingProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { granted } = useConsent();
  const online = useOnline();
  const create = useCreateScan();
  const [store] = useState(createBrowserStore);
  const [checks, setChecks] = useState<PendingCheck[]>([]);
  const busy = useRef(false);

  const refresh = useCallback(async () => setChecks(await freshChecks(store, Date.now())), [store]);

  const sendOne = useCallback(
    async (check: PendingCheck): Promise<boolean> => {
      const outcome = await sendCheck(store, check, (input) => create.mutateAsync(input));
      if (outcome.status === 'sent') {
        const scan = outcome.value;
        toast.success(t('pending.sent'), {
          duration: 15_000,
          action: { label: t('pending.open'), onClick: () => navigate(`/app/scan/${scan.id}`) },
        });
      } else if (outcome.status === 'dropped') {
        toast.error(t('pending.failed'));
      }
      return outcome.status !== 'later';
    },
    [store, create, navigate, t],
  );

  const sendAll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (const check of await freshChecks(store, Date.now())) {
        if (!(await sendOne(check))) break; // still no connection: keep the rest for later
      }
    } finally {
      busy.current = false;
      await refresh();
    }
  }, [store, sendOne, refresh]);

  // Send what is waiting when the app opens with a connection, and again each time it comes back.
  useEffect(() => {
    if (granted && online) void sendAll();
    else void refresh();
    // The functions change every render; what matters is the connection and the consent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, granted]);

  // Withdrawing consent means nothing more is sent, so nothing is kept either.
  useEffect(() => {
    if (!granted) void store.clear().then(refresh);
  }, [granted, store, refresh]);

  const value = useMemo<PendingValue>(
    () => ({
      checks,
      saveForLater: async (input) => {
        const saved = await saveCheck(store, input, Date.now());
        await refresh();
        return saved !== null;
      },
      sendNow: async (id) => {
        const check = checks.find((item) => item.id === id);
        const sent = check ? await sendOne(check) : true;
        await refresh();
        return sent;
      },
      remove: async (id) => {
        await store.remove(id);
        await refresh();
      },
      clear: async () => {
        await store.clear();
        await refresh();
      },
    }),
    [checks, store, sendOne, refresh],
  );

  return <PendingContext.Provider value={value}>{children}</PendingContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePending(): PendingValue {
  const context = useContext(PendingContext);
  if (!context) throw new Error('usePending must be used inside PendingProvider');
  return context;
}
