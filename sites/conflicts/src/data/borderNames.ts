import { useSyncExternalStore } from 'react';
import { loadJson } from './assets.ts';

/**
 * German polity names for the border snapshots, keyed by the exact English
 * string — built by pipeline/5-flags.ts into borders/names.de.json.
 *
 * Loaded lazily and only for German: English users never pay the fetch, German
 * users pay a few KB on their first country hover. Names without an entry fall
 * back to English, mirroring how conflict translations degrade per field.
 *
 * The translated string is display-only. Everything that joins on a polity name
 * (flag index, involvement matching) keeps consuming the English original.
 */
let names: Record<string, string> | null = null;
let pending = false;
let version = 0;
const listeners = new Set<() => void>();

export function ensureBorderNames(locale: string): void {
  if (locale !== 'de' || names || pending) return;
  pending = true;
  void loadJson<Record<string, string>>('borders/names.de.json')
    .then((data) => {
      names = data;
      version++;
      for (const fn of listeners) fn();
    })
    .catch(() => {
      pending = false;
    });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Re-renders the caller once the name file arrives. */
export function useBorderNames(locale: string): number {
  ensureBorderNames(locale);
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}

/** The polity's display name in the given locale, falling back to English. */
export function politicalName(name: string | null, locale: string): string | null {
  if (!name) return null;
  if (locale !== 'de') return name;
  return names?.[name] ?? name;
}
