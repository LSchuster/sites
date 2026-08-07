import { dataUrl, loadJson } from './assets.ts';

/**
 * Polity name → ISO 3166-1 alpha-2 code, built at build time by pipeline/5-flags.ts.
 *
 * Only ~7% of the 2,837 polity names across all snapshots resolve to a flag, and
 * that is the correct outcome rather than a gap to paper over: most names are
 * historical states with no modern successor ("Great Khanate") or ethnographic
 * groupings ("Savanna hunter-gatherers"). Showing a modern flag for those would be
 * an invention. No flag is the honest answer.
 */
let index: Record<string, string> | null = null;
let pending = false;
const listeners = new Set<() => void>();

export function ensureFlags(): void {
  if (index || pending) return;
  pending = true;
  void loadJson<Record<string, string>>('flags/index.json')
    .then((data) => {
      index = data;
      for (const fn of listeners) fn();
    })
    .catch(() => {
      pending = false;
    });
}

export function onFlagsLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** ISO code for a polity, or null when there is no honest modern equivalent. */
export function flagCode(name: string | null | undefined): string | null {
  if (!name) return null;
  ensureFlags();
  return index?.[name] ?? null;
}

export function flagUrl(code: string): string {
  return dataUrl(`flags/${code}.svg`);
}
