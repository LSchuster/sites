import { useSyncExternalStore } from 'react';
import type { Messages } from './types.ts';
import { en } from './locales/en.ts';
import { de } from './locales/de.ts';

/**
 * Adding a language is two steps and nothing else:
 *   1. create `locales/<code>.ts` exporting a `Messages` object
 *   2. register it here
 * The `Messages` interface makes step 1 self-checking — an incomplete translation
 * will not compile.
 */
export const LOCALES = { en, de } as const;

export type Locale = keyof typeof LOCALES;

export const LOCALE_CODES = Object.keys(LOCALES) as Locale[];

const STORAGE_KEY = 'conflicts.locale';

function isLocale(value: string | null | undefined): value is Locale {
  return value != null && Object.prototype.hasOwnProperty.call(LOCALES, value);
}

/**
 * Stored choice first, then the browser's preference list, then English.
 * `navigator.languages` entries are region-tagged ("de-AT"), so match on the
 * primary subtag — an Austrian visitor should get German.
 */
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage can throw in private modes; fall through to detection.
  }
  const candidates = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  for (const tag of candidates) {
    const primary = tag?.split('-')[0]?.toLowerCase();
    if (isLocale(primary)) return primary;
  }
  return 'en';
}

let current: Locale = detectLocale();
const listeners = new Set<() => void>();

function applyDocumentLang(locale: Locale): void {
  if (typeof document === 'undefined') return;
  const m = LOCALES[locale];
  document.documentElement.lang = m.bcp47;
  // index.html ships the English title/description so first paint and crawlers
  // without JS see something sensible; this localizes them as soon as we run.
  document.title = m.app.documentTitle;
  document.querySelector('meta[name="description"]')?.setAttribute('content', m.app.metaDescription);
}
applyDocumentLang(current);

export function getLocale(): Locale {
  return current;
}

export function getMessages(): Messages {
  return LOCALES[current];
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Persisting is a convenience, not a requirement.
  }
  applyDocumentLang(locale);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The active message dictionary. Re-renders the component on language change. */
export function useT(): Messages {
  return useSyncExternalStore(
    subscribe,
    () => LOCALES[current],
    () => LOCALES[current],
  );
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

/**
 * The renderer's rAF loop needs the dictionary without a React subscription.
 * It reads this directly each frame.
 */
export function messagesNow(): Messages {
  return getMessages();
}

export type { Messages } from './types.ts';
