import { loadJson } from './assets.ts';
import { getLocale } from '../i18n/index.ts';

/** Compact wire tuple: [year, lon×100, lat×100, deaths, name] */
type Wire = [number, number, number, number, string];

export interface Battle {
  year: number;
  lon: number;
  lat: number;
  deaths: number;
  /** Display name in the active locale; English where no translation exists. */
  name: string;
}

let battles: Battle[] = [];
/** English names by battle index — the join key with the overlay files and the restore path. */
let englishNames: string[] = [];
let state: 'idle' | 'loading' | 'ready' = 'idle';

/**
 * Sparse per-locale name overlays (battle index → localized Wikidata label),
 * written by the battles pipeline in the same run as battles.json so the
 * indices always line up. Fetched only when a non-English locale actually has
 * the battle layer on screen; a locale without an overlay file resolves to {}
 * and every name falls back to English — per-entry fallback, like the rest of
 * the i18n layer.
 */
const overlays = new Map<string, Record<string, string> | 'loading'>();
let appliedLocale = 'en';

/** Stamp the active locale's names onto the battles, fetching the overlay on first need. */
function syncNames(): void {
  if (state !== 'ready') return;
  const locale = getLocale();
  if (locale === appliedLocale) return;
  let overlay: Record<string, string> = {};
  if (locale !== 'en') {
    const cached = overlays.get(locale);
    if (cached === undefined) {
      overlays.set(locale, 'loading');
      void loadJson<Record<string, string>>(`battles.names.${locale}.json`)
        .then((map) => overlays.set(locale, map))
        .catch(() => overlays.set(locale, {}));
      return; // applied on a later call, once the fetch lands
    }
    if (cached === 'loading') return;
    overlay = cached;
  }
  battles.forEach((b, i) => {
    b.name = overlay[i] ?? englishNames[i] ?? b.name;
  });
  appliedLocale = locale;
}

/**
 * Loaded on demand — only once the user zooms in far enough to want this detail.
 * 90 KB gzipped is cheap, but not cheap enough to spend on someone who never
 * leaves the world view.
 */
export function ensureBattles(): void {
  if (state !== 'idle') return;
  state = 'loading';
  void loadJson<{ battles: Wire[] }>('battles.json').then((data) => {
    battles = data.battles.map(([year, lon, lat, deaths, name]) => ({
      year,
      lon: lon / 100,
      lat: lat / 100,
      deaths,
      name,
    }));
    englishNames = data.battles.map((w) => w[4]);
    state = 'ready';
    syncNames();
  });
}

export function battlesReady(): boolean {
  return state === 'ready';
}

/** Battles within `window` years of `year`, nearest first. */
export function battlesNear(year: number, window = 4): Battle[] {
  if (state !== 'ready') return [];
  syncNames(); // two comparisons when nothing changed — safe on the frame path
  const out: Battle[] = [];
  for (const b of battles) {
    if (Math.abs(b.year - year) <= window) out.push(b);
  }
  return out;
}
