/**
 * English → German name dictionary, shared by the conflict compile step (side
 * members) and the flags/border-names step (polity names).
 *
 * Two layers: Intl.DisplayNames supplies every modern state for free (keyed by
 * its *English* display name), and data/curated/i18n/names.de.yaml overrides and
 * extends it — historical polities, peoples, and any spelling where our curated
 * data differs from CLDR ("DR Congo", "Turkey"). Hand entries always win, so a
 * CLDR update cannot silently change a name we chose deliberately.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { ROOT } from './lib.ts';

const NAMES_DE = resolve(ROOT, 'data/curated/i18n/names.de.yaml');

export async function germanNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Modern states: English display name → German display name, per ISO code.
  // First-writer-wins over the A–Z scan, mirroring displayNameMap() in
  // 5-flags.ts: deprecated codes answer too and sort after the live ones.
  const en = new Intl.DisplayNames(['en'], { type: 'region' });
  const de = new Intl.DisplayNames(['de'], { type: 'region' });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      let enName: string | undefined;
      let deName: string | undefined;
      try {
        enName = en.of(code);
        deName = de.of(code);
      } catch {
        continue;
      }
      // Intl returns the code itself for unassigned pairs.
      if (!enName || !deName || enName === code || deName === code) continue;
      if (enName !== deName && !map.has(enName)) map.set(enName, deName);
    }
  }

  const hand = parse(await readFile(NAMES_DE, 'utf8')) as Record<string, string>;
  for (const [english, german] of Object.entries(hand)) map.set(english, german);

  return map;
}
