import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

export type ThemeChoice = 'light' | 'dark' | 'auto';
export type TextSize = 'normal' | 'large' | 'xlarge';

export interface Prefs {
  theme: ThemeChoice;
  text: TextSize;
  highContrast: boolean;
}

interface ThemeContextValue extends Prefs {
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeChoice) => void;
  setText: (text: TextSize) => void;
  setHighContrast: (value: boolean) => void;
}

const STORAGE_KEY = 'kavach.prefs';
/** Light is the default, as decided by the product owner. */
const DEFAULT_PREFS: Prefs = { theme: 'light', text: 'normal', highContrast: false };

function loadPrefs(): Prefs {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: ['light', 'dark', 'auto'].includes(parsed.theme ?? '')
        ? (parsed.theme as ThemeChoice)
        : DEFAULT_PREFS.theme,
      text: ['normal', 'large', 'xlarge'].includes(parsed.text ?? '')
        ? (parsed.text as TextSize)
        : DEFAULT_PREFS.text,
      highContrast: parsed.highContrast === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [systemDark, setSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    prefs.theme === 'auto' ? (systemDark ? 'dark' : 'light') : prefs.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.text = prefs.text;
    if (prefs.highContrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
  }, [resolvedTheme, prefs.text, prefs.highContrast]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      writeStorage(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...prefs,
      resolvedTheme,
      setTheme: (theme) => update({ theme }),
      setText: (text) => update({ text }),
      setHighContrast: (highContrast) => update({ highContrast }),
    }),
    [prefs, resolvedTheme, update],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
