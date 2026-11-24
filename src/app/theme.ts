import { useSyncExternalStore } from 'react';

/**
 * Light / dark / system theme (R-S3). The choice is a preference of this device, so it's kept in
 * localStorage rather than in the user's Drive data. "System" (the default) follows the OS and
 * switches live when the OS does.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'trackworth.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // e.g. storage disabled
  }
}

export function readPreference(): ThemePreference {
  const value = storage()?.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(preference: ThemePreference = readPreference()): ResolvedTheme {
  if (preference !== 'system') return preference;
  return systemPrefersDark() ? 'dark' : 'light';
}

function apply() {
  document.documentElement.classList.toggle('dark', resolveTheme() === 'dark');
}

function emit() {
  apply();
  for (const listener of listeners) listener();
}

export function setPreference(preference: ThemePreference): void {
  const store = storage();
  if (preference === 'system') store?.removeItem(STORAGE_KEY);
  else store?.setItem(STORAGE_KEY, preference);
  emit();
}

/** Apply the theme before the first render, and follow OS changes while on "system". */
export function startTheme(): void {
  apply();
  if (typeof window.matchMedia === 'function') {
    window.matchMedia(DARK_QUERY).addEventListener('change', emit);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => `${readPreference()}|${resolveTheme()}`;

export function useTheme(): { preference: ThemePreference; resolved: ResolvedTheme } {
  const [preference, resolved] = useSyncExternalStore(subscribe, snapshot, snapshot).split('|') as [
    ThemePreference,
    ResolvedTheme,
  ];
  return { preference, resolved };
}
