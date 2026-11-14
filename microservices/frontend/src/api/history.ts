import type { RiskLevel } from '@/components/ui/risk';
import type { ScanSummary } from './types';
import type { KeyValueStorage } from './mock/storage';

const KEY = 'kavach.history';

/**
 * The list of earlier checks, kept on this device. Without an account the server cannot know whose
 * checks are whose, so it keeps none; this list holds only what the website may show after the
 * 15 minutes: the id, kind, risk level and time, never the file, the text or the details.
 * (With accounts, in Step 7, this moves to the server.)
 */
export function createHistory(storage: KeyValueStorage) {
  function load(): ScanSummary[] {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as ScanSummary[]) : [];
    } catch {
      return [];
    }
  }
  const save = (items: ScanSummary[]) => storage.setItem(KEY, JSON.stringify(items));

  return {
    list: () => load().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    has: (id: string) => load().some((item) => item.id === id),
    add(item: ScanSummary) {
      save([item, ...load().filter((existing) => existing.id !== item.id)]);
    },
    setRisk(id: string, riskLevel: RiskLevel) {
      save(load().map((item) => (item.id === id ? { ...item, riskLevel } : item)));
    },
    remove: (id: string) => save(load().filter((item) => item.id !== id)),
    clear: () => storage.removeItem(KEY),
  };
}
