import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage';

/** "auto" follows the phone's own Data Saver setting and a slow connection. */
export type LowDataChoice = 'auto' | 'on' | 'off';

const KEY = 'kavach.lowdata';
const listeners = new Set<() => void>();

export function readChoice(): LowDataChoice {
  const saved = readStorage(KEY);
  return saved === 'on' || saved === 'off' ? saved : 'auto';
}

export function saveChoice(choice: LowDataChoice): void {
  writeStorage(KEY, choice);
  listeners.forEach((listener) => listener());
}

interface Connection {
  saveData?: boolean;
  effectiveType?: string;
}

/** True when the phone itself says data is expensive or the network is very slow. */
export function connectionIsSlow(): boolean {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  return connection?.saveData === true || /^(slow-)?2g$/.test(connection?.effectiveType ?? '');
}

export function isLowData(choice: LowDataChoice = readChoice()): boolean {
  return choice === 'on' || (choice === 'auto' && connectionIsSlow());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useLowDataChoice(): [LowDataChoice, (choice: LowDataChoice) => void] {
  return [useSyncExternalStore(subscribe, readChoice, () => 'auto'), saveChoice];
}

/** Whether to save data right now: smaller photos, and the result is asked for less often. */
export function useLowData(): boolean {
  const [choice] = useLowDataChoice();
  return isLowData(choice);
}
