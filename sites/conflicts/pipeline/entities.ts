/**
 * Cross-snapshot entity identity, territory tints, and label anchors.
 *
 * Adds four working properties to every *named* feature before slimming:
 *   E  — stable entity id shared by the same polity across snapshots
 *   C  — territory tint slot 0..6, adjacency-aware, constant per entity
 *   LA — label anchor [lon, lat]: pole of inaccessibility of the largest part
 *   AR — spherical area in millionths of a steradian (label sizing/priority)
 *
 * Identity is resolved in three tiers:
 *   1. exact canonical name (wartime " (X)" suffix stripped, case/diacritics
 *      folded) — the only join key the source data offers;
 *   2. the curated alias table data/curated/entity-aliases.yaml;
 *   3. a conservative fuzzy tier reusing src/data/nameMatch.ts, with two
 *      guards: names that ever co-occur in one snapshot are never merged
 *      (co-occurrence proves distinctness), and matches whose centroids sit
 *      more than FUZZY_MAX_DEG apart are rejected (kills France ↔ French
 *      West Africa while keeping German Empire ↔ Germany).
 *
 * Nothing here invents history. Identity drives only visual continuity —
 * tint stability, label crossfades, selection persistence. A wrong merge
 * shows as a shared colour, never as a changed border or name.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
import { geoArea, geoCentroid, geoEqualEarth } from 'd3-geo';
import type { GeoPermissibleObjects } from 'd3-geo';
import polylabel from 'polylabel';
import { topology } from 'topojson-server';
import { neighbors } from 'topojson-client';
import { namesMatch, tokensOf, PREFIX } from '../src/data/nameMatch.ts';
import { ROOT } from './lib.ts';

const ALIAS_FILE = resolve(ROOT, 'data/curated/borders/entity-aliases.yaml');
const REPORT_FILE = resolve(ROOT, 'data/cache/entities-report.json');

/** Tint slots available in src/theme.ts TERRITORY. */
const COLORS = 7;

/**
 * Fuzzy matches farther apart than this (great-circle degrees) are rejected.
 * 15° keeps German Empire ↔ Germany (≈2°) while rejecting chains like
 * China ↔ French Indochina (≈18°) that share only a generic token.
 */
const FUZZY_MAX_DEG = 15;

export interface EntityFeature {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: unknown;
}

export interface EntitySnapshot {
  year: number;
  features: EntityFeature[];
}

export interface EntitiesReport {
  entities: {
    id: number;
    color: number;
    names: string[];
    years: number[];
  }[];
  fuzzyMerges: [string, string][];
  aliasWarnings: string[];
  /** Fraction of adjacency edges whose endpoints share a tint. */
  sameColorAdjacency: number;
}

/**
 * The wartime snapshots rename occupied polities to "X (Occupier)". Both the
 * join key AND the fuzzy tokens must use the stripped base name — tokenizing
 * the raw display once dragged "Syria (France)" into the Francia group via
 * the occupier's token.
 */
const stripSuffix = (name: string): string => name.replace(/ \([^()]*\)$/, '').trim();

export const canonical = (name: string): string =>
  stripSuffix(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function degreeDistance(a: [number, number], b: [number, number]): number {
  const dLon = Math.abs(a[0] - b[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const dLat = a[1] - b[1];
  return Math.hypot(dLon, dLat);
}

interface NameInfo {
  display: string;
  years: Set<number>;
  centroid: [number, number];
  area: number;
}

/**
 * Union-find over canonical names, refusing merges whose year sets overlap
 * (both names in one snapshot proves two distinct polities) or that the
 * curated never-list forbids.
 */
class Grouping {
  private parent = new Map<string, string>();
  private years = new Map<string, Set<number>>();
  private members = new Map<string, string[]>();
  private forbidden: Map<string, Set<string>>;

  constructor(names: Map<string, NameInfo>, forbidden: Map<string, Set<string>>) {
    this.forbidden = forbidden;
    for (const [canon, info] of names) {
      this.parent.set(canon, canon);
      this.years.set(canon, new Set(info.years));
      this.members.set(canon, [canon]);
    }
  }

  find(x: string): string {
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root) ?? root;
    // Path compression.
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur) ?? root;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  /** Merge unless the groups co-occur or any member pair is forbidden. */
  union(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return true;
    const ya = this.years.get(ra) ?? new Set();
    const yb = this.years.get(rb) ?? new Set();
    for (const y of ya) if (yb.has(y)) return false;
    const ma = this.members.get(ra) ?? [ra];
    const mb = this.members.get(rb) ?? [rb];
    for (const x of ma) {
      const banned = this.forbidden.get(x);
      if (banned) for (const y of mb) if (banned.has(y)) return false;
    }
    this.parent.set(rb, ra);
    this.years.set(ra, new Set([...ya, ...yb]));
    this.members.set(ra, [...ma, ...mb]);
    return true;
  }
}

/** Largest polygon of a (Multi)Polygon by spherical area, as rings. */
function largestPolygon(geometry: unknown): number[][][] | null {
  const g = geometry as { type: string; coordinates: unknown };
  if (g.type === 'Polygon') return g.coordinates as number[][][];
  if (g.type !== 'MultiPolygon') return null;
  let best: number[][][] | null = null;
  let bestArea = -1;
  for (const poly of g.coordinates as number[][][][]) {
    const area = geoArea({ type: 'Polygon', coordinates: poly } as GeoPermissibleObjects);
    if (area < 2 * Math.PI && area > bestArea) {
      bestArea = area;
      best = poly;
    }
  }
  return best;
}

/**
 * Label anchor for a feature: pole of inaccessibility of its largest polygon,
 * computed in projected (display) space so the "widest open ground" matches
 * what the reader sees. Two fallbacks to the spherical centroid: features
 * spanning the antimeridian (whose planar projection self-crosses), and
 * features too small to give polylabel real geometry to work with — for those
 * the pole would land outside the outline.
 */
function anchorOf(feature: EntityFeature, ref: ReturnType<typeof geoEqualEarth>): [number, number] | null {
  const rings = largestPolygon(feature.geometry);
  if (!rings || !rings[0] || rings[0].length < 4) return null;

  const centroidFallback = (): [number, number] | null => {
    const c = geoCentroid({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: rings },
    } as GeoPermissibleObjects);
    return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? [c[0], c[1]] : null;
  };

  let lonMin = Infinity;
  let lonMax = -Infinity;
  for (const [lon] of rings[0] as [number, number][]) {
    if (lon < lonMin) lonMin = lon;
    if (lon > lonMax) lonMax = lon;
  }
  if (lonMax - lonMin > 180) return centroidFallback();

  const projected: number[][][] = [];
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const ring of rings) {
    const planar: number[][] = [];
    for (const pt of ring) {
      const p = ref(pt as [number, number]);
      if (!p) return null;
      planar.push(p);
      if (p[0] < xMin) xMin = p[0];
      if (p[0] > xMax) xMax = p[0];
      if (p[1] < yMin) yMin = p[1];
      if (p[1] > yMax) yMax = p[1];
    }
    projected.push(planar);
  }
  if (xMax - xMin < 2 || yMax - yMin < 2) return centroidFallback();

  const pole = polylabel(projected, 0.5);
  const inv = ref.invert?.(pole);
  if (!inv || !Number.isFinite(inv[0]) || !Number.isFinite(inv[1])) return null;
  return [inv[0], inv[1]];
}

export async function assignEntities(snapshots: EntitySnapshot[]): Promise<EntitiesReport> {
  // ── Gather name facts ──────────────────────────────────────────────────────
  const names = new Map<string, NameInfo>();
  for (const { year, features } of snapshots) {
    for (const f of features) {
      const display = (f.properties?.['NAME'] ?? null) as string | null;
      if (!display) continue;
      const canon = canonical(display);
      if (!canon) continue;
      let info = names.get(canon);
      const area = geoArea(f as GeoPermissibleObjects);
      if (!info) {
        const c = geoCentroid(f as GeoPermissibleObjects);
        info = { display, years: new Set(), centroid: [c[0], c[1]], area };
        names.set(canon, info);
      } else if (area > info.area && area < 2 * Math.PI) {
        const c = geoCentroid(f as GeoPermissibleObjects);
        info.centroid = [c[0], c[1]];
        info.area = area;
      }
      info.years.add(year);
    }
  }

  const aliasWarnings: string[] = [];
  const spec = parse(await readFile(ALIAS_FILE, 'utf8')) as {
    groups?: string[][];
    never?: [string, string][];
  } | null;

  // The never-list blocks fuzzy false friends ("Britany" ↔ "Great Britain",
  // "Romania" ↔ "Roman Empire") that share a token root but are unrelated.
  const forbidden = new Map<string, Set<string>>();
  for (const [a, b] of spec?.never ?? []) {
    const ca = canonical(a);
    const cb = canonical(b);
    if (!forbidden.has(ca)) forbidden.set(ca, new Set());
    if (!forbidden.has(cb)) forbidden.set(cb, new Set());
    forbidden.get(ca)?.add(cb);
    forbidden.get(cb)?.add(ca);
  }

  const groups = new Grouping(names, forbidden);

  // ── Tier 2: curated aliases ────────────────────────────────────────────────
  for (const group of spec?.groups ?? []) {
    const canons = group.map(canonical).filter((c) => {
      if (names.has(c)) return true;
      aliasWarnings.push(`alias name not found in any snapshot: "${c}"`);
      return false;
    });
    for (let i = 1; i < canons.length; i++) {
      const a = canons[0];
      const b = canons[i];
      if (!a || !b) continue;
      if (!groups.union(a, b)) {
        aliasWarnings.push(`alias group members co-occur, not merged: "${a}" + "${b}"`);
      }
    }
  }

  // ── Tier 3: fuzzy, bucketed by token prefix so it is not all-pairs ─────────
  const buckets = new Map<string, string[]>();
  for (const [canon, info] of names) {
    for (const tok of tokensOf(stripSuffix(info.display))) {
      const key = tok.slice(0, PREFIX);
      const list = buckets.get(key) ?? [];
      list.push(canon);
      buckets.set(key, list);
    }
  }
  const fuzzyMerges: [string, string][] = [];
  const tried = new Set<string>();
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (!a || !b) continue;
        const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (tried.has(pairKey)) continue;
        tried.add(pairKey);
        const ia = names.get(a);
        const ib = names.get(b);
        if (!ia || !ib) continue;
        if (degreeDistance(ia.centroid, ib.centroid) > FUZZY_MAX_DEG) continue;
        if (!namesMatch(stripSuffix(ia.display), stripSuffix(ib.display))) continue;
        if (groups.union(a, b)) fuzzyMerges.push([ia.display, ib.display]);
      }
    }
  }

  // ── Entity ids, deterministic ──────────────────────────────────────────────
  const members = new Map<string, string[]>();
  for (const canon of names.keys()) {
    const root = groups.find(canon);
    const list = members.get(root) ?? [];
    list.push(canon);
    members.set(root, list);
  }
  const entityFacts = [...members.entries()].map(([root, canons]) => {
    const years = new Set<number>();
    for (const c of canons) for (const y of names.get(c)?.years ?? []) years.add(y);
    return { root, canons: canons.sort(), years: [...years].sort((a, b) => a - b) };
  });
  entityFacts.sort(
    (a, b) => b.years.length - a.years.length || a.root.localeCompare(b.root),
  );
  const entityOf = new Map<string, number>();
  entityFacts.forEach((e, id) => {
    for (const c of e.canons) entityOf.set(c, id);
  });

  // ── Adjacency across all snapshots ─────────────────────────────────────────
  const edges = new Map<number, Map<number, number>>();
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const m = edges.get(lo) ?? new Map<number, number>();
    m.set(hi, (m.get(hi) ?? 0) + 1);
    edges.set(lo, m);
  };
  for (const { features } of snapshots) {
    const topo = topology({ world: { type: 'FeatureCollection', features } } as never);
    const geoms = (topo.objects['world'] as unknown as { geometries: unknown[] }).geometries;
    const adj = neighbors(geoms as never);
    for (let i = 0; i < features.length; i++) {
      const nameA = (features[i]?.properties?.['NAME'] ?? null) as string | null;
      if (!nameA) continue;
      const ea = entityOf.get(canonical(nameA));
      if (ea == null) continue;
      for (const j of adj[i] ?? []) {
        const nameB = (features[j]?.properties?.['NAME'] ?? null) as string | null;
        if (!nameB) continue;
        const eb = entityOf.get(canonical(nameB));
        if (eb != null) addEdge(ea, eb);
      }
    }
  }
  // Symmetric view of the edge map, built once — the colouring loop reads it
  // per entity and must not rescan every edge each time.
  const sym = new Map<number, Map<number, number>>();
  for (const [lo, m] of edges) {
    for (const [hi, w] of m) {
      const a = sym.get(lo) ?? new Map<number, number>();
      a.set(hi, (a.get(hi) ?? 0) + w);
      sym.set(lo, a);
      const b = sym.get(hi) ?? new Map<number, number>();
      b.set(lo, (b.get(lo) ?? 0) + w);
      sym.set(hi, b);
    }
  }

  // ── Greedy colouring: long-lived entities first ────────────────────────────
  const colorOf = new Map<number, number>();
  const globalUse = new Array<number>(COLORS).fill(0);
  entityFacts.forEach((_e, id) => {
    const nw = sym.get(id) ?? new Map<number, number>();
    let best = 0;
    let bestCost = Infinity;
    for (let c = 0; c < COLORS; c++) {
      let cost = 0;
      for (const [nb, w] of nw) if (colorOf.get(nb) === c) cost += w;
      const tieBreak = (globalUse[c] ?? 0) / 1e6;
      if (cost + tieBreak < bestCost) {
        bestCost = cost + tieBreak;
        best = c;
      }
    }
    colorOf.set(id, best);
    globalUse[best] = (globalUse[best] ?? 0) + 1;
  });

  // Same-tint adjacency rate, for the report and the validator.
  let conflictW = 0;
  let totalW = 0;
  for (const [lo, m] of edges) {
    for (const [hi, w] of m) {
      totalW += w;
      if (colorOf.get(lo) === colorOf.get(hi)) conflictW += w;
    }
  }

  // ── Stamp features ─────────────────────────────────────────────────────────
  // 2000px world width: enough resolution that only genuinely tiny features
  // (sub-2px projected) fall back from polylabel to the centroid.
  const ref = geoEqualEarth().fitWidth(2000, { type: 'Sphere' });
  for (const { features } of snapshots) {
    for (const f of features) {
      const display = (f.properties?.['NAME'] ?? null) as string | null;
      if (!display) continue;
      const id = entityOf.get(canonical(display));
      if (id == null) continue;
      const anchor = anchorOf(f, ref);
      const area = geoArea(f as GeoPermissibleObjects);
      f.properties = {
        ...f.properties,
        E: id,
        C: colorOf.get(id) ?? 0,
        ...(anchor
          ? { LA: [Math.round(anchor[0] * 10) / 10, Math.round(anchor[1] * 10) / 10] }
          : {}),
        AR: Math.round(area * 1e6),
      };
    }
  }

  // ── Report for humans ──────────────────────────────────────────────────────
  const report: EntitiesReport = {
    entities: entityFacts.map((e, id) => ({
      id,
      color: colorOf.get(id) ?? 0,
      names: e.canons.map((c) => names.get(c)?.display ?? c),
      years: e.years,
    })),
    fuzzyMerges,
    aliasWarnings,
    sameColorAdjacency: totalW ? conflictW / totalW : 0,
  };
  await mkdir(dirname(REPORT_FILE), { recursive: true });
  await writeFile(REPORT_FILE, JSON.stringify(report, null, 1));
  return report;
}
