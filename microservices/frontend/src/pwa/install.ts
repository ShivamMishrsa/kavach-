import { useSyncExternalStore } from 'react';

/** The browser's own install prompt (Chrome and Edge on Android and desktop). Not in the types yet. */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The browser sends this once, early. It is kept here, from the moment the page loads, so that a
// button on the settings screen can use it later.
let waiting: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // keep it for our own button instead of the browser's mini bar
    waiting = event as InstallPrompt;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    waiting = null;
    installed = true;
    changed();
  });
}

export type InstallState = 'installed' | 'available' | 'ios' | 'other';

export function installState(): InstallState {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed || standalone) return 'installed';
  if (waiting) return 'available';
  // Safari on an iPhone or iPad has no prompt: the person adds it from the share menu.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'other';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useInstall(): { state: InstallState; install: () => Promise<void> } {
  const state = useSyncExternalStore(subscribe, installState, () => 'other' as InstallState);
  return {
    state,
    install: async () => {
      const prompt = waiting;
      if (!prompt) return;
      await prompt.prompt();
      await prompt.userChoice;
      waiting = null; // the browser allows each prompt once
      changed();
    },
  };
}
