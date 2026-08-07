/**
 * Battles pipeline — Wikidata SPARQL.
 *
 * Pulls every geolocated, dated battle from year 0 onward (~6,500 of them). These
 * are the fine-grained layer that appears when you zoom in: the curated conflicts
 * give the shape of history, these give its texture.
 *
 * Coverage is wildly uneven and that is not a defect to hide — 13 battles for the
 * 2nd century against 1,854 for the 19th. It reflects what was written down and
 * what later got typed into a database, and the About page says so.
 *
 * Queried a century at a time; the public endpoint times out on the full range.
 *
 * Run: npm run data:battles
 */
import { gzipSync } from 'node:zlib';
import { writeOut, kb } from './lib.ts';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'conflicts-io/0.1 (static historical atlas; contact via repo)';

/**
 * Locales beyond English whose Wikidata labels are baked into a sparse
 * `battles.names.<locale>.json` (battle index → localized name, only where it
 * exists and differs from English). Add a code here when the app gains a
 * language, then re-run this script — the extra labels ride in the same
 * queries, so more locales cost no extra requests.
 */
const LABEL_LOCALES = ['de'] as const;

interface Row {
  b: { value: string };
  bLabel?: { value: string };
  date: { value: string };
  coord: { value: string };
  deaths?: { value: string };
  /** Per-locale labels, bound as ?label_<locale>. */
  [labelVar: string]: { value: string } | undefined;
}

/** Compact tuple: [year, lon×100, lat×100, deaths|0, name] */
type Battle = [number, number, number, number, string];

async function query(from: number, to: number): Promise<Row[]> {
  const labelVars = LABEL_LOCALES.map((l) => `?label_${l}`).join(' ');
  const labelClauses = LABEL_LOCALES.map(
    (l) => `OPTIONAL { ?b rdfs:label ?label_${l} . FILTER(LANG(?label_${l}) = "${l}") }`,
  ).join('\n      ');
  const sparql = `
    SELECT ?b ?bLabel ?date ?coord ?deaths ${labelVars} WHERE {
      ?b wdt:P31/wdt:P279* wd:Q178561 ;
         wdt:P625 ?coord ;
         wdt:P585 ?date .
      OPTIONAL { ?b wdt:P1120 ?deaths }
      ${labelClauses}
      FILTER(YEAR(?date) >= ${from} && YEAR(?date) < ${to})
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(sparql)}`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
    });
    if (res.ok) {
      const json = (await res.json()) as { results: { bindings: Row[] } };
      return json.results.bindings;
    }
    // The public endpoint rate-limits and occasionally 502s; back off and retry.
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error(`SPARQL failed for ${from}–${to}`);
}

/** "Point(8.125833 52.4075)" → [lon, lat] */
function parsePoint(wkt: string): [number, number] | null {
  const m = /Point\(([-\d.eE]+)\s+([-\d.eE]+)\)/.exec(wkt);
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
}

async function main(): Promise<void> {
  const seen = new Set<string>();
  /** Tuple plus its per-locale labels; sorted together so the sparse name maps
   *  can be keyed by the battle's index in the final sorted array. */
  const entries: { t: Battle; names: Partial<Record<string, string>> }[] = [];
  let skipped = 0;

  // Wider windows early (sparse), narrower later (dense) to stay under the timeout.
  const windows: [number, number][] = [
    [0, 500], [500, 1000], [1000, 1300], [1300, 1500], [1500, 1600], [1600, 1700],
    [1700, 1750], [1750, 1800], [1800, 1830], [1830, 1860], [1860, 1900],
    [1900, 1920], [1920, 1950], [1950, 1980], [1980, 2000], [2000, 2027],
  ];

  for (const [from, to] of windows) {
    const rows = await query(from, to);
    let kept = 0;
    for (const row of rows) {
      const point = parsePoint(row.coord.value);
      const label = row.bLabel?.value ?? '';
      if (!point || !label || label.startsWith('Q')) {
        skipped++;
        continue;
      }
      const year = Number(row.date.value.slice(0, row.date.value.indexOf('-', 1)));
      if (!Number.isFinite(year) || year < 0 || year > 2026) {
        skipped++;
        continue;
      }
      // Wikidata often holds several coordinate statements per battle; one mark each.
      const key = `${row.b.value}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);

      const deaths = row.deaths ? Math.round(Number(row.deaths.value)) : 0;
      const names: Partial<Record<string, string>> = {};
      for (const locale of LABEL_LOCALES) {
        const localized = row[`label_${locale}`]?.value;
        if (localized && localized !== label) names[locale] = localized;
      }
      entries.push({
        t: [
          year,
          Math.round(point[0] * 100),
          Math.round(point[1] * 100),
          Number.isFinite(deaths) && deaths > 0 ? deaths : 0,
          label,
        ],
        names,
      });
      kept++;
    }
    console.log(`  ${String(from).padStart(4)}–${String(to).padEnd(4)}  ${String(kept).padStart(5)} battles`);
    await new Promise((r) => setTimeout(r, 700)); // be polite to the public endpoint
  }

  entries.sort((a, b) => a.t[0] - b.t[0]);
  const battles = entries.map((e) => e.t);

  const json = JSON.stringify({ battles });
  const bytes = await writeOut('battles.json', json);
  const gz = gzipSync(json).length;

  // Sparse per-locale overlays, keyed by index into the sorted battles array.
  // Generated in the same run as battles.json — the two files must never be
  // rebuilt independently or the indices desync.
  for (const locale of LABEL_LOCALES) {
    const map: Record<number, string> = {};
    entries.forEach((e, i) => {
      const name = e.names[locale];
      if (name) map[i] = name;
    });
    const njson = JSON.stringify(map);
    const nbytes = await writeOut(`battles.names.${locale}.json`, njson);
    console.log(
      `  battles.names.${locale}.json — ${Object.keys(map).length} of ${battles.length} ` +
        `differ from English (${kb(nbytes)}, gzip ${kb(gzipSync(njson).length)})`,
    );
  }

  const withDeaths = battles.filter((b) => b[3] > 0).length;
  console.log(
    `\n${battles.length} battles · ${kb(bytes)} (gzip ${kb(gz)}) · ` +
      `${withDeaths} with casualty figures · ${skipped} rows skipped`,
  );

  const byCentury = new Map<number, number>();
  for (const b of battles) {
    const c = Math.floor(b[0] / 100) * 100;
    byCentury.set(c, (byCentury.get(c) ?? 0) + 1);
  }
  const sparse = [...byCentury.entries()].filter(([, n]) => n < 40).map(([c]) => c);
  console.log(`  centuries with under 40 recorded battles: ${sparse.join(', ') || 'none'}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
