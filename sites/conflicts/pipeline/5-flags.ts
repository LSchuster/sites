/**
 * Flags pipeline.
 *
 * Resolves the polity names in the border snapshots to ISO 3166-1 alpha-2 codes and
 * copies just those SVGs out of flag-icons into public/data/flags/.
 *
 * Two decisions worth stating:
 *
 * 1. SVG, not emoji. Regional-indicator emoji (🇩🇪) are the obvious cheap answer and
 *    they do not work: Windows ships no country-flag glyphs, so Chrome and Edge on
 *    Windows render the letter pair "DE" in a box. A large share of visitors would
 *    see garbage.
 *
 * 2. The bulk of the name→code mapping is *generated* from Intl.DisplayNames rather
 *    than typed out. That covers every modern state in both English and German for
 *    free and cannot drift out of date. Only genuine historical successors need the
 *    hand-written table below.
 *
 * Run: npm run data:flags
 */
import { readdir, readFile, copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OUT, ROOT, ensureDir, writeOut, kb } from './lib.ts';
import { germanNameMap } from './name-dictionary.ts';

const FLAG_SRC = resolve(ROOT, 'node_modules/flag-icons/flags/4x3');
const FLAG_OUT = resolve(OUT, 'flags');

/**
 * Historical polities mapped to their modern successor state.
 *
 * Only entries where the succession is uncontroversial and a reader would expect
 * the flag. Deliberately omitted: Prussia (not coextensive with Germany), Korea
 * (two successors), Congo (two states of that name), Yugoslavia, Czechoslovakia,
 * the Holy Roman Empire, and every pre-national empire — showing a modern flag for
 * those would be an invention, and no flag is the honest answer.
 */
const HISTORICAL: Record<string, string> = {
  'united kingdom of great britain and ireland': 'gb',
  'united kingdom of great britain': 'gb',
  'great britain': 'gb',
  england: 'gb',
  scotland: 'gb',
  'kingdom of italy': 'it',
  'kingdom of spain': 'es',
  'kingdom of france': 'fr',
  'kingdom of portugal': 'pt',
  'kingdom of denmark': 'dk',
  'kingdom of sweden': 'se',
  'kingdom of norway': 'no',
  'german empire': 'de',
  'german reich': 'de',
  'nazi germany': 'de',
  'west germany': 'de',
  'east germany': 'de',
  'russian empire': 'ru',
  'soviet union': 'ru',
  ussr: 'ru',
  'ottoman empire': 'tr',
  'republic of turkey': 'tr',
  persia: 'ir',
  'persian empire': 'ir',
  siam: 'th',
  'rattanakosin kingdom': 'th',
  ayutthaya: 'th',
  burma: 'mm',
  ceylon: 'lk',
  simhala: 'lk',
  'dutch east indies': 'id',
  'netherlands east indies': 'id',
  malaya: 'my',
  'đại việt': 'vn',
  'dai viet': 'vn',
  'north vietnam': 'vn',
  'south vietnam': 'vn',
  'manchu empire': 'cn',
  'qing empire': 'cn',
  'qing dynasty': 'cn',
  'ming dynasty': 'cn',
  'empire of japan': 'jp',
  'imperial japan': 'jp',
  abyssinia: 'et',
  'kingdom of hungary': 'hu',
  'kingdom of poland': 'pl',
  'polish-lithuanian commonwealth': 'pl',
  'kingdom of greece': 'gr',
  'kingdom of romania': 'ro',
  'kingdom of serbia': 'rs',
  'kingdom of bulgaria': 'bg',
  'swiss confederation': 'ch',
  'dutch republic': 'nl',
  'united provinces': 'nl',
  'gambia, the': 'gm',
  'tanzania, united republic of': 'tz',
  'korea, republic of': 'kr',
  "korea, democratic people's republic of": 'kp',
  'united states of america': 'us',
  'confederate states of america': 'us',
};

/** Names that must never get a flag even if a fuzzy match would find one. */
const BLOCKED = new Set([
  'georgia', // the US state and the country collide in casual matching
  'congo',
  'korea',
  'prussia',
  'macedonia',
  'holy roman empire',
  'byzantine empire',
  'roman empire',
  'western roman empire',
  'eastern roman empire',
  'yugoslavia',
  'czechoslovakia',
  'sardinia',
  'venice',
  'sicily',
  'navarre',
]);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N},\s'-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reverse map of ISO 3166-1 alpha-2 region names, in the given locale.
 *
 * Restricted to codes that flag-icons actually ships, and first-writer-wins. Both
 * constraints matter: `Intl.DisplayNames` still answers for deprecated and reserved
 * codes, and those sort *after* the live ones, so a naive last-writer-wins map sends
 * "France" to FX (Metropolitan France), "United Kingdom" to UK (reserved), "Russia"
 * to SU (Soviet Union) and "Serbia" to YU (Yugoslavia) — none of which have a flag
 * file, so the biggest countries on the map silently ended up with no flag at all.
 */
function displayNameMap(locale: string, available: ReadonlySet<string>): Map<string, string> {
  const dn = new Intl.DisplayNames([locale], { type: 'region' });
  const map = new Map<string, string>();
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const lower = code.toLowerCase();
      if (!available.has(lower)) continue;
      let label: string | undefined;
      try {
        label = dn.of(code);
      } catch {
        continue;
      }
      // Intl returns the code itself for unassigned pairs.
      if (!label || label === code) continue;
      const key = normalize(label);
      if (!map.has(key)) map.set(key, lower);
    }
  }
  return map;
}

async function main(): Promise<void> {
  const available = new Set(
    (await readdir(FLAG_SRC)).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)),
  );

  const english = displayNameMap('en', available);
  const german = displayNameMap('de', available);

  const lookup = new Map<string, string>();
  for (const [name, code] of english) lookup.set(name, code);
  for (const [name, code] of german) if (!lookup.has(name)) lookup.set(name, code);
  for (const [name, code] of Object.entries(HISTORICAL)) lookup.set(normalize(name), code);
  for (const name of BLOCKED) lookup.delete(normalize(name));

  console.log(`  ${english.size} English + ${german.size} German region names, ` +
    `${Object.keys(HISTORICAL).length} historical aliases, ${BLOCKED.size} blocked`);

  // Every polity name that actually appears on a map. Suzerain names ("subject
  // to …") are collected separately: they need a German translation but must not
  // widen the flag index.
  const borderDir = resolve(OUT, 'borders');
  const files = (await readdir(borderDir)).filter((f) => f.endsWith('.topo.json'));
  const polities = new Set<string>();
  const suzerains = new Set<string>();
  for (const file of files) {
    const topo = JSON.parse(await readFile(resolve(borderDir, file), 'utf8')) as {
      objects: { world: { geometries?: { properties?: { n?: string; s?: string } }[] } };
    };
    for (const g of topo.objects.world.geometries ?? []) {
      const n = g.properties?.n;
      if (n) polities.add(n);
      const s = g.properties?.s;
      if (s) suzerains.add(s);
    }
  }

  const resolved: Record<string, string> = {};
  const needed = new Set<string>();
  for (const name of polities) {
    const code = lookup.get(normalize(name));
    if (!code) continue;
    resolved[name] = code;
    needed.add(code);
  }

  // Copy only the flags we can actually use.
  await rm(FLAG_OUT, { recursive: true, force: true });
  await ensureDir(FLAG_OUT);
  let bytes = 0;
  let missing = 0;
  for (const code of needed) {
    if (!available.has(code)) {
      // Only reachable from the hand-written HISTORICAL table.
      missing++;
      console.warn(`  ! no flag asset for "${code}" — check the HISTORICAL table`);
      for (const [name, c] of Object.entries(resolved)) if (c === code) delete resolved[name];
      continue;
    }
    const src = resolve(FLAG_SRC, `${code}.svg`);
    await copyFile(src, resolve(FLAG_OUT, `${code}.svg`));
    bytes += (await readFile(src)).length;
  }

  const indexBytes = await writeOut('flags/index.json', JSON.stringify(resolved));

  // German polity names for the country hover card, keyed by the exact English
  // string in the snapshots. Layered, historical-name-safe: exact entries from
  // the shared dictionary first (so "Russian Empire" becomes "Russisches
  // Reich"), then modern states via their ISO code — deliberately NOT the
  // HISTORICAL successor table, which would relabel empires as modern states.
  // The snapshot data mixes en dashes and hyphens ("Polish–Lithuanian
  // Commonwealth"), so dictionary lookups are dash-insensitive, and colonial
  // names of the shape "X (Y)" fall back to translating both parts.
  const dict = await germanNameMap();
  const deDisplay = new Intl.DisplayNames(['de'], { type: 'region' });
  const germanFor = (name: string): string | null => {
    const direct =
      dict.get(name) ??
      dict.get(name.replace(/[–—]/g, '-')) ??
      dict.get(name.replace(/-/g, '–'));
    if (direct) return direct;
    const code = english.get(normalize(name));
    if (code) return deDisplay.of(code.toUpperCase()) ?? null;
    const paren = /^(.+) \(([^()]+)\)$/.exec(name);
    if (paren?.[1] && paren[2]) {
      const outer = germanFor(paren[1]) ?? paren[1];
      const inner = germanFor(paren[2]) ?? paren[2];
      if (outer !== paren[1] || inner !== paren[2]) return `${outer} (${inner})`;
    }
    return null;
  };
  const germanNames: Record<string, string> = {};
  let unresolved = 0;
  for (const name of [...polities, ...suzerains]) {
    const g = germanFor(name);
    if (g && g !== name) germanNames[name] = g;
    else if (!g) unresolved++;
  }
  const namesBytes = await writeOut('borders/names.de.json', JSON.stringify(germanNames));
  console.log(
    `  borders/names.de.json: ${Object.keys(germanNames).length} German polity names ` +
      `(${kb(namesBytes)}); ${unresolved} names stay English`,
  );

  console.log(
    `  ${polities.size} distinct polity names → ${Object.keys(resolved).length} with a flag ` +
      `(${((Object.keys(resolved).length / polities.size) * 100).toFixed(0)}%)`,
  );
  console.log(`  ${needed.size - missing} flag files, ${kb(bytes)} total, index ${kb(indexBytes)}`);
  if (missing) console.log(`  ${missing} codes had no SVG and were dropped`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
