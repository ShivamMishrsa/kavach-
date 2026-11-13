export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage when available, otherwise memory only (private mode / blocked storage). */
export function createBrowserStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  const fallback: KeyValueStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  };
  try {
    const probe = '__kavach_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    return fallback;
  }
  return {
    getItem: (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    removeItem: (key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export function createMemoryStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  };
}
