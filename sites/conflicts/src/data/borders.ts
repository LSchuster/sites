import { feature, mesh } from 'topojson-client';
import { geoArea } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, MultiLineString, Position } from 'geojson';
import type { Topology } from 'topojson-specification';
import { loadJson } from './assets.ts';
import { prefersReducedMotion } from '../motion.ts';
import type { BorderProps } from '../types.ts';

export type BorderCollection = FeatureCollection<Geometry, BorderProps>;

/**
 * A snapshot carries pre-extracted meshes alongside the features.
 *
 * Stroking 250 individual features draws every internal border twice (once from
 * each side) and costs 250 path operations. TopoJSON knows which arcs are shared,
 * so `internal` is every boundary between two polities and `coast` is every arc
 * used by only one — the outline of the land itself. Two path strokes instead of
 * 250, and the coastline can be drawn brighter than the internal borders, which is
 * what makes the continents read.
 */
export interface BorderSnapshot {
  fc: BorderCollection;
  /** Boundaries between polities the source draws with confidence. */
  internal: MultiLineString;
  /**
   * Boundaries where either side carries the source's own "approximate"
   * precision rating (p ≥ 3 — medieval spheres of influence, steppe marches).
   * Drawn softer than `internal`: the uncertainty is data, not a defect.
   */
  internalUncertain: MultiLineString;
  coast: MultiLineString;
}

/** Years for which a border snapshot exists. Filled from borders/index.json. */
let snapshotYears: number[] = [];
const cache = new Map<number, BorderSnapshot>();
const pending = new Map<number, Promise<BorderSnapshot>>();

export async function initBorders(): Promise<number[]> {
  if (snapshotYears.length) return snapshotYears;
  const index = await loadJson<{ years: number[] }>('borders/index.json');
  snapshotYears = [...index.years].sort((a, b) => a - b);
  return snapshotYears;
}

export function getSnapshotYears(): number[] {
  return snapshotYears;
}

/** More than half the sphere, in steradians. No real polity comes close. */
const HALF_SPHERE = 2 * Math.PI;

/**
 * Repair polygons whose rings are wound the wrong way.
 *
 * GeoJSON's spherical interpretation — the one d3-geo implements — treats ring
 * orientation as meaningful: a ring wound the wrong way describes the *complement*
 * of the area you meant. A single inverted ring therefore fills the entire globe
 * and hides the map beneath a flat wash.
 *
 * This is not hypothetical. The 1914 snapshot's "United Kingdom of Great Britain
 * and Ireland" is a MultiPolygon of 40 pieces — the empire's scattered islands —
 * and the build pipeline's simplification collapses several of them into four-point
 * rings with inverted winding. Each such ring measures 4π steradians: the whole
 * sphere.
 *
 * The repair must be **per polygon**, not per feature. An earlier attempt reversed
 * every ring in any feature whose total area was implausible, which merely swapped
 * the broken pieces for the sound ones and changed nothing on screen. Each polygon
 * is judged and corrected on its own.
 */
function fixPolygon(rings: Position[][]): Position[][] {
  const outer = rings[0];
  if (!outer || outer.length < 4) return rings;
  const area = geoArea({ type: 'Polygon', coordinates: [outer] });
  if (area <= HALF_SPHERE) return rings;
  // Reverse only the exterior ring; holes keep their own orientation.
  return [[...outer].reverse(), ...rings.slice(1)];
}

function fixWinding(f: Feature<Geometry, BorderProps>): Feature<Geometry, BorderProps> {
  const g = f.geometry;
  if (g.type === 'Polygon') {
    return { ...f, geometry: { ...g, coordinates: fixPolygon(g.coordinates) } };
  }
  if (g.type === 'MultiPolygon') {
    return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fixPolygon) } };
  }
  return f;
}

function loadSnapshot(year: number): Promise<BorderSnapshot> {
  const cached = cache.get(year);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(year);
  if (existing) return existing;

  const p = loadJson<Topology>(`borders/world_${year}.topo.json`).then((topo) => {
    const obj = topo.objects['world'];
    if (!obj) throw new Error(`world_${year}.topo.json has no "world" object`);
    const raw = feature(topo, obj) as unknown as FeatureCollection<Geometry, Record<string, unknown>>;
    // Expand the pipeline's abbreviated keys back into readable props.
    const fc: BorderCollection = {
      type: 'FeatureCollection',
      features: raw.features.map((f) =>
        fixWinding({
          ...f,
          properties: {
            name: (f.properties?.['n'] as string) ?? null,
            subjectTo: (f.properties?.['s'] as string) ?? null,
            precision: Number(f.properties?.['p'] ?? 1),
            entity: (f.properties?.['e'] as number) ?? null,
            color: (f.properties?.['c'] as number) ?? null,
            labelAt: (f.properties?.['l'] as [number, number]) ?? null,
            area: Number(f.properties?.['a'] ?? 0),
          },
        }),
      ),
    };
    // topojson-client's mesh() types its object parameter more narrowly than the
    // Topology index signature provides; the value is correct at runtime.
    const meshObj = obj as Parameters<typeof mesh>[1];
    type MeshGeom = { properties?: { p?: number } };
    const prec = (g: unknown): number => Number((g as MeshGeom).properties?.p ?? 1);
    const snapshot: BorderSnapshot = {
      fc,
      internal: mesh(topo, meshObj, (a, b) => a !== b && prec(a) < 3 && prec(b) < 3) as MultiLineString,
      internalUncertain: mesh(
        topo,
        meshObj,
        (a, b) => a !== b && (prec(a) >= 3 || prec(b) >= 3),
      ) as MultiLineString,
      coast: mesh(topo, meshObj, (a, b) => a === b) as MultiLineString,
    };
    cache.set(year, snapshot);
    pending.delete(year);
    return snapshot;
  });
  pending.set(year, p);
  return p;
}

export interface BorderPair {
  a: BorderSnapshot | null;
  b: BorderSnapshot | null;
  /** 0 = fully snapshot a, 1 = fully snapshot b. */
  mix: number;
  yearA: number;
  yearB: number;
}

/**
 * How much of the gap before a snapshot's own year the crossfade occupies.
 * Proportional so century-wide medieval gaps still morph visibly, floored at a
 * year so adjacent modern snapshots don't switch as a single-frame pop.
 */
const FADE_FRACTION = 0.15;
const FADE_MIN_YEARS = 1;

/**
 * The two snapshots bracketing `year`, and how far between them we are.
 *
 * `mix` is deliberately NOT linear across the gap. A snapshot dated 1945
 * describes 1945; blending it in evenly from 1938 onward put occupation-zone
 * Germany on the 1941 map. Borders therefore hold the earlier snapshot for most
 * of the gap and the incoming one fades in only over the final stretch —
 * anachronism is capped at the fade window instead of half the gap.
 */
export function bracket(year: number): { yearA: number; yearB: number; mix: number } {
  const years = snapshotYears;
  if (!years.length) return { yearA: year, yearB: year, mix: 0 };
  const first = years[0] ?? year;
  const last = years[years.length - 1] ?? year;
  if (year <= first) return { yearA: first, yearB: first, mix: 0 };
  if (year >= last) return { yearA: last, yearB: last, mix: 0 };

  let lo = 0;
  for (let i = 0; i < years.length - 1; i++) {
    const y = years[i];
    if (y !== undefined && y <= year) lo = i;
  }
  const yearA = years[lo] ?? first;
  const yearB = years[lo + 1] ?? last;
  const span = yearB - yearA;
  if (span <= 0) return { yearA, yearB, mix: 0 };
  const fade = Math.max(FADE_MIN_YEARS, span * FADE_FRACTION);
  const intoFade = year - yearA - (span - fade);
  const raw = Math.min(1, Math.max(0, intoFade / fade));
  // Reduced motion: a hard cut at the middle of the fade window instead of a
  // dissolve — the snapshot switch still happens at the same year.
  if (prefersReducedMotion()) return { yearA, yearB, mix: raw >= 0.5 ? 1 : 0 };
  // Smoothstep. The raw ramp is C0 but not C1 — playback visibly "kicked" as
  // each fade window opened; easing both ends removes the kick.
  return { yearA, yearB, mix: raw * raw * (3 - 2 * raw) };
}

/**
 * Synchronous read of the bracketing pair, kicking off loads for anything missing.
 * The renderer calls this every frame and simply draws whatever is ready — a
 * snapshot that hasn't arrived yet renders as nothing rather than blocking.
 */
export function getPair(year: number): BorderPair {
  const { yearA, yearB, mix } = bracket(year);
  const a = cache.get(yearA) ?? null;
  const b = yearB === yearA ? a : (cache.get(yearB) ?? null);
  if (!a) void loadSnapshot(yearA);
  if (!b && yearB !== yearA) void loadSnapshot(yearB);
  return { a, b, mix, yearA, yearB };
}

/** The snapshot in effect at `year` — the one whose names should be trusted. */
export function snapshotAt(year: number): BorderSnapshot | null {
  const { yearA, yearB, mix } = bracket(year);
  return cache.get(mix > 0.5 ? yearB : yearA) ?? cache.get(yearA) ?? null;
}

/** Warm the cache around a year so scrubbing doesn't flash empty. */
export function prefetchAround(year: number): void {
  const { yearA, yearB } = bracket(year);
  void loadSnapshot(yearA);
  if (yearB !== yearA) void loadSnapshot(yearB);
}
