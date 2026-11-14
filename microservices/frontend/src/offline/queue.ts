import { ApiError, type ScanInput } from '@/api/types';

/**
 * Checks that could not be sent because there was no connection, kept on this phone until there is
 * one. This is a deliberate exception to "nothing is stored": it is the person's own notice on
 * their own phone, they are told, it is deleted as soon as it is sent, after an hour, when they
 * remove it, when they delete their data, and when they withdraw consent. Nothing is ever sent
 * while the app is closed (there is no background sync): it goes only while the app is open.
 */
export type PendingInput =
  { kind: 'notice'; file: File } | { kind: 'notice'; text: string } | { kind: 'link'; url: string };

export interface PendingCheck {
  id: string;
  savedAt: number; // milliseconds since 1970
  input: PendingInput;
}

export interface PendingStore {
  list(): Promise<PendingCheck[]>;
  put(check: PendingCheck): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** How long a saved check is kept. */
export const KEEP_MS = 60 * 60 * 1000;
/** Most checks kept at once: a phone is not an archive. */
export const MAX_PENDING = 5;

export const isFresh = (check: PendingCheck, now: number): boolean => now - check.savedAt < KEEP_MS;

/** Deletes what is older than an hour and returns what is left, oldest first. */
export async function freshChecks(store: PendingStore, now: number): Promise<PendingCheck[]> {
  const all = await store.list();
  await Promise.all(all.filter((check) => !isFresh(check, now)).map((c) => store.remove(c.id)));
  return all.filter((check) => isFresh(check, now)).sort((a, b) => a.savedAt - b.savedAt);
}

/** Keeps a check for later. Returns it, or null when there are already too many. */
export async function saveCheck(
  store: PendingStore,
  input: PendingInput,
  now: number,
): Promise<PendingCheck | null> {
  if ((await freshChecks(store, now)).length >= MAX_PENDING) return null;
  const check = { id: crypto.randomUUID(), savedAt: now, input };
  await store.put(check);
  return check;
}

/** A check in the form that can be kept, or null for the ones that never need it (demo samples). */
export function toPending(input: ScanInput): PendingInput | null {
  if (input.kind === 'link') return { kind: 'link', url: input.url };
  if (input.file) return { kind: 'notice', file: input.file };
  if (input.text) return { kind: 'notice', text: input.text };
  return null;
}

export type Outcome<T> = { status: 'sent'; value: T } | { status: 'later' } | { status: 'dropped' };

/**
 * Tries to send one saved check. It is deleted once it has gone. When the connection is down, the
 * server is busy or the person asked too often, it stays for the next try. Any other refusal (the
 * server will never accept it) deletes it too, so it does not come back every time.
 */
export async function sendCheck<T>(
  store: PendingStore,
  check: PendingCheck,
  send: (input: PendingInput) => Promise<T>,
): Promise<Outcome<T>> {
  try {
    const value = await send(check.input);
    await store.remove(check.id);
    return { status: 'sent', value };
  } catch (problem) {
    const retryable =
      problem instanceof ApiError &&
      (problem.code === 'network' || problem.code === 'busy' || problem.code === 'rate_limited');
    if (retryable) return { status: 'later' };
    await store.remove(check.id);
    return { status: 'dropped' };
  }
}

// ---------- where they are kept ----------

export function createMemoryStore(): PendingStore {
  const items = new Map<string, PendingCheck>();
  return {
    list: async () => [...items.values()],
    put: async (check) => void items.set(check.id, check),
    remove: async (id) => void items.delete(id),
    clear: async () => items.clear(),
  };
}

const DB = 'kavach-pending';
const TABLE = 'checks';

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}

/** IndexedDB, which can keep a photo; memory only when the browser will not give it out. */
export function createBrowserStore(): PendingStore {
  let opened: Promise<IDBDatabase> | null = null;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(DB, 1);
      opening.onupgradeneeded = () => opening.result.createObjectStore(TABLE, { keyPath: 'id' });
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    }));
  const table = async (mode: IDBTransactionMode) =>
    (await open()).transaction(TABLE, mode).objectStore(TABLE);

  if (typeof indexedDB === 'undefined') return createMemoryStore();
  const fallback = createMemoryStore();
  /** Uses the database; if it fails (private mode), the check lives in memory for this visit. */
  const guarded = async <T>(attempt: () => Promise<T>, other: () => Promise<T>): Promise<T> => {
    try {
      return await attempt();
    } catch {
      return other();
    }
  };
  return {
    list: () =>
      guarded(
        async () => request((await table('readonly')).getAll()),
        () => fallback.list(),
      ),
    put: (check) =>
      guarded(
        async () => void (await request((await table('readwrite')).put(check))),
        () => fallback.put(check),
      ),
    remove: (id) =>
      guarded(
        async () => void (await request((await table('readwrite')).delete(id))),
        () => fallback.remove(id),
      ),
    clear: () =>
      guarded(
        async () => void (await request((await table('readwrite')).clear())),
        () => fallback.clear(),
      ),
  };
}
