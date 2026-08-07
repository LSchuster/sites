/**
 * Borders pipeline.
 *
 * Turns aourednik/historical-basemaps GeoJSON snapshots (1–1.8 MB each) into
 * simplified, quantized TopoJSON small enough to load while scrubbing a timeline.
 *
 * Source: https://github.com/aourednik/historical-basemaps  (GPL-3.0)
 *
 * Run: npm run data:borders
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'yaml';
import { topology } from 'topojson-server';
// @ts-expect-error — topojson-simplify ships no types for the ESM entry
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { quantize, merge as topoMerge } from 'topojson-client';
import { ROOT, cachedFetch, writeOut, kb } from './lib.ts';
import { assignEntities } from './entities.ts';

const REPO = 'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson';
const CURATED_DIR = resolve(ROOT, 'data/curated/borders');

/**
 * Snapshot years available upstream from year 0 onward. `bc1` is 1 BCE, which we
 * treat as year 0 — the start of our timeline.
 *
 * Upstream jumps straight from 1938 to 1945, so the Second World War — the deadliest
 * conflict on the whole atlas — had no map of its own. The wartime years are curated
 * transforms of the 1938 base (merges and renames only; the source geometry cannot
 * be split, so no front lines): see data/curated/borders/*.yaml.
 */
const SNAPSHOTS: { file: string; year: number; curated?: string }[] = [
  { file: 'world_bc1', year: 0 },
  ...[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500,
    1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1880, 1900, 1914, 1920, 1930, 1938, 1945,
    1960, 1994, 2000, 2010].map((y) => ({ file: `world_${y}`, year: y })),
  ...[1939, 1940, 1941, 1942, 1943, 1944].map((y) => ({
    file: 'world_1938',
    year: y,
    curated: `world_${y}.yaml`,
  })),
].sort((a, b) => a.year - b.year);

/**
 * Byte budget per snapshot. Scrubbing loads two at a time, so keep these small —
 * but not at any cost: dense snapshots (1492 has 1,946 features, mostly indigenous
 * American territories) hit the budget only by simplifying into unrecognisable
 * shapes. MIN_DETAIL stops that, and those few files are allowed to run over.
 * Static hosts gzip these to roughly a third on the wire.
 */
const TARGET_BYTES = 200 * 1024;
const MIN_DETAIL = 0.25;
const QUANTIZATION = 1e4;

interface RawFeature {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: unknown;
}

/** A curated transform of a base year's features — see data/curated/borders/. */
interface CuratedSpec {
  base: number;
  /** Dissolve the named features into the target, removing their mutual borders. */
  merge?: Record<string, string[]>;
  /** Keep the borders, mark the controller — the dataset's own occupation convention. */
  occupy?: { feature: string; subjectTo: string; name?: string }[];
  /** Undo an occupation present in the base file: strip the "(X)" suffix, clear SUBJECTO. */
  release?: string[];
}

/**
 * Apply a curated spec to the base features.
 *
 * Ops match by exact NAME and apply to every feature carrying it — the base files
 * hold duplicates (1938 has two "Italy") and missing one would leave a phantom
 * polity behind. A name that matches nothing is a hard error: historical data fails
 * silently, so a typo must break the build rather than quietly change nothing.
 */
function applySpec(features: RawFeature[], spec: CuratedSpec, specFile: string): RawFeature[] {
  const matching = (name: string) =>
    features.filter((f) => (f.properties?.['NAME'] ?? null) === name);
  const mustMatch = (name: string): RawFeature[] => {
    const found = matching(name);
    if (!found.length) {
      throw new Error(`${specFile}: no feature named "${name}" in world_${spec.base}`);
    }
    return found;
  };

  for (const [target, sources] of Object.entries(spec.merge ?? {})) {
    const keep = mustMatch(target);
    const group = [...keep, ...sources.flatMap(mustMatch)];
    // Dissolve through a throwaway topology: merge() drops the arcs the group's
    // polygons share. A plain MultiPolygon of the pieces would keep those seams,
    // and the renderer's mesh() would draw them in the bright coast style.
    const topo = topology({ g: { type: 'FeatureCollection', features: group } } as never);
    const dissolved = topoMerge(
      topo as never,
      (topo.objects['g'] as unknown as { geometries: never[] }).geometries,
    );
    const merged: RawFeature = {
      type: 'Feature',
      properties: { ...keep[0]?.properties },
      geometry: dissolved,
    };
    features = features.filter((f) => !group.includes(f));
    features.push(merged);
  }

  for (const { feature, subjectTo, name } of spec.occupy ?? []) {
    for (const f of mustMatch(feature)) {
      f.properties = { ...f.properties, NAME: name ?? `${feature} (${subjectTo})`, SUBJECTO: subjectTo };
    }
  }

  for (const name of spec.release ?? []) {
    for (const f of mustMatch(name)) {
      const props = { ...f.properties, NAME: name.replace(/ \([^()]*\)$/, '') };
      delete props['SUBJECTO'];
      f.properties = props;
    }
  }

  return features;
}

/**
 * A note on the antimeridian, because this looks like a bug and is not.
 *
 * Several features — Antarctica, the USSR, Fiji — have bounding boxes spanning the
 * full -180..180 longitude range. That is correct: Antarctica wraps the pole, and
 * the USSR and Fiji straddle the dateline. Do NOT "normalise" these by shifting
 * negative longitudes by +360. Doing so turns Antarctica's circumpolar ring into a
 * self-intersecting polygon spanning 0..360, which d3-geo then fills across the
 * entire globe — the whole map becomes one flat colour.
 *
 * d3-geo already performs correct spherical antimeridian clipping on valid GeoJSON.
 * Leave the coordinates alone.
 */

/**
 * Strip properties to the abbreviated fields the renderer uses. Unnamed
 * features are kept — they are unclaimed/uninhabited land and give us the land
 * silhouette for free. The E/C/LA/AR working keys are stamped by the entities
 * pass (pipeline/entities.ts) before this runs.
 */
function slimProperties(feature: RawFeature): RawFeature {
  const p = feature.properties ?? {};
  // A handful of upstream features carry whitespace-only names; those are
  // unnamed land, not polities called "   ".
  const rawName = (p['NAME'] ?? null) as string | null;
  const name = rawName && rawName.trim() ? rawName : null;
  const subjectTo = (p['SUBJECTO'] ?? null) as string | null;
  const precision = Number(p['BORDERPRECISION'] ?? 1);
  const out: Record<string, unknown> = { p: precision };
  if (name) out['n'] = name;
  // Only record the overlord when it differs from the polity itself.
  if (subjectTo && subjectTo !== name) out['s'] = subjectTo;
  if (p['E'] != null) out['e'] = p['E'];
  if (p['C'] != null) out['c'] = p['C'];
  if (p['LA'] != null) out['l'] = p['LA'];
  if (p['AR'] != null) out['a'] = p['AR'];
  return { ...feature, properties: out };
}

/**
 * Binary-search the simplification threshold to land just under the byte budget.
 *
 * Order matters: `presimplify` discards the topology's quantization transform and
 * expands arcs back into absolute floats, so quantizing *before* simplifying is
 * wasted work. We simplify first, then re-quantize — which is where nearly all of
 * the size reduction actually comes from.
 *
 * `quantile(pre, p)` returns the weight at which proportion `p` of points survive,
 * so larger p means more detail and a bigger file. We want the largest p that fits.
 */
function simplifyToBudget(
  topo: unknown,
  targetBytes: number,
): { topo: unknown; bytes: number; retained: number } {
  const pre = presimplify(topo);

  const sizeAt = (p: number) => {
    const simplified = simplify(pre, quantile(pre, p));
    const quantized = quantize(simplified as never, QUANTIZATION);
    return { topo: quantized, bytes: Buffer.byteLength(JSON.stringify(quantized)), retained: p };
  };

  const full = sizeAt(1);
  if (full.bytes <= targetBytes) return full;

  const floor = sizeAt(MIN_DETAIL);
  if (floor.bytes > targetBytes) return floor; // too dense to fit without wrecking it

  let lo = MIN_DETAIL;
  let hi = 1;
  let best = floor;
  for (let i = 0; i < 11; i++) {
    const mid = (lo + hi) / 2;
    const attempt = sizeAt(mid);
    if (attempt.bytes > targetBytes) {
      hi = mid;
    } else {
      best = attempt;
      lo = mid;
    }
  }
  return best;
}

async function main(): Promise<void> {
  const index: { year: number; file: string; bytes: number; gz: number }[] = [];

  // Phase A — fetch and curate every snapshot into memory. The entities pass
  // needs the whole timeline at once to resolve identity across snapshots.
  const loaded: { year: number; curated?: string; rawBytes: number; features: RawFeature[] }[] = [];
  for (const { file, year, curated } of SNAPSHOTS) {
    const raw = await cachedFetch(`${REPO}/${file}.geojson`, `borders/${file}.geojson`);
    const geo = JSON.parse(raw.toString('utf8')) as { features: RawFeature[] };
    let base = geo.features.filter((f) => f.geometry != null);
    if (curated) {
      const spec = parse(await readFile(resolve(CURATED_DIR, curated), 'utf8')) as CuratedSpec;
      base = applySpec(base, spec, curated);
    }
    loaded.push({ year, curated, rawBytes: raw.length, features: base });
  }

  // Phase B — cross-snapshot identity, tints, label anchors (stamps E/C/LA/AR).
  const report = await assignEntities(loaded);
  console.log(
    `  entities: ${report.entities.length} across ${loaded.length} snapshots · ` +
      `${report.fuzzyMerges.length} fuzzy merges · ` +
      `same-tint adjacency ${(report.sameColorAdjacency * 100).toFixed(1)}%` +
      `${report.aliasWarnings.length ? ` · ${report.aliasWarnings.length} alias warning(s)` : ''}`,
  );
  for (const w of report.aliasWarnings) console.log(`    ~ ${w}`);

  // Phase C — slim, build topology, simplify to budget, write. Unchanged from
  // the original pipeline: the presimplify → simplify → quantize order is
  // load-bearing (see simplifyToBudget).
  for (const { year, curated, rawBytes, features: base } of loaded) {
    const features = base.map(slimProperties);

    const topo = topology({ world: { type: 'FeatureCollection', features } } as never);
    const { topo: small, bytes, retained } = simplifyToBudget(topo, TARGET_BYTES);

    const json = JSON.stringify(small);
    const outName = `borders/world_${year}.topo.json`;
    await writeOut(outName, json);
    const gz = gzipSync(json).length;
    index.push({ year, file: `world_${year}.topo.json`, bytes, gz });

    console.log(
      `  ${String(year).padStart(4)}  ${String(features.length).padStart(4)} features  ` +
        `${kb(rawBytes).padStart(8)} → ${kb(bytes).padStart(7)}  ` +
        `(gzip ${kb(gz).padStart(6)})  detail ${(retained * 100).toFixed(0).padStart(3)}%` +
        `${curated ? '  (curated)' : ''}`,
    );
  }

  await writeOut('borders/index.json', JSON.stringify({ years: index.map((d) => d.year) }));

  const total = index.reduce((s, d) => s + d.bytes, 0);
  const totalGz = index.reduce((s, d) => s + d.gz, 0);
  console.log(
    `\n${index.length} snapshots — ${kb(total)} raw, ${kb(totalGz)} gzipped ` +
      `(${kb(totalGz / index.length)} avg over the wire)`,
  );
  const over = index.filter((d) => d.bytes > TARGET_BYTES);
  if (over.length) {
    console.log(`  ${over.length} over budget (too dense to simplify safely): ${over.map((d) => d.year).join(', ')}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
