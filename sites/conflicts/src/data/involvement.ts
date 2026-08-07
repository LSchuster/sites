import type { Conflict } from '../types.ts';
import { activeAt } from './conflicts.ts';
import { namesMatch } from './nameMatch.ts';

/**
 * Matching historical polity names to conflict belligerents.
 *
 * The token matcher lives in nameMatch.ts (the build pipeline shares it for
 * cross-snapshot entity identity). It is a heuristic and it is presented as
 * one: the UI labels these matches "named belligerent" and keeps them separate
 * from the purely geographic "within the theatre" list, so a wrong guess is
 * visible rather than authoritative.
 */

/** Every belligerent name a conflict mentions, sides and members alike. */
function belligerentNames(c: Conflict): string[] {
  const out: string[] = [];
  for (const side of c.sides) {
    out.push(side.name);
    if (side.members) out.push(...side.members);
  }
  return out;
}

export interface Involvement {
  /** Conflicts naming this polity as a belligerent. */
  named: Conflict[];
  /** Conflicts whose theatre covers this polity but which do not name it. */
  nearby: Conflict[];
}

/** Great-circle-ish degree distance. Good enough at continental scale. */
function degreeDistance(a: [number, number], b: [number, number]): number {
  const dLon = Math.abs(a[0] - b[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const dLat = a[1] - b[1];
  return Math.hypot(dLon, dLat);
}

/**
 * What is happening to this country right now.
 * `at` is the country's location, used for the geographic fallback.
 */
export function involvementOf(
  countryName: string | null,
  at: [number, number] | null,
  year: number,
): Involvement {
  const active = activeAt(year);
  const named: Conflict[] = [];
  const nearby: Conflict[] = [];

  for (const c of active) {
    const isNamed =
      countryName != null && belligerentNames(c).some((n) => namesMatch(n, countryName));
    if (isNamed) {
      named.push(c);
      continue;
    }
    if (at && c.extent && degreeDistance(c.centroid, at) <= c.extent) nearby.push(c);
  }

  const bySize = (x: Conflict, y: Conflict) => y.total.best - x.total.best;
  named.sort(bySize);
  nearby.sort(bySize);
  return { named, nearby };
}

/**
 * Normalised names of every polity named as a belligerent in the given year, for
 * tinting the map. Cached per integer year — this runs on the render path.
 */
let tintYear = -1;
let tintNames: string[] = [];

export function belligerentNamesAt(year: number): string[] {
  const y = Math.floor(year);
  if (y === tintYear) return tintNames;
  tintYear = y;
  const set = new Set<string>();
  for (const c of activeAt(y)) for (const n of belligerentNames(c)) set.add(n);
  tintNames = [...set];
  return tintNames;
}

/**
 * Is this map feature a named belligerent in `year`?
 *
 * Memoised per year. The tint layer asks this for every feature in the snapshot
 * each time the year ticks over — twenty times a second at 1× playback — and each
 * miss costs a token comparison against every belligerent name in the year. The
 * cache turns that into a map lookup after the first pass.
 */
let matchYear = -1;
let matchCache = new Map<string, boolean>();

export function isBelligerent(featureName: string | null, year: number): boolean {
  if (!featureName) return false;
  const y = Math.floor(year);
  if (y !== matchYear) {
    matchYear = y;
    matchCache = new Map();
  }
  const hit = matchCache.get(featureName);
  if (hit !== undefined) return hit;
  const result = belligerentNamesAt(y).some((n) => namesMatch(n, featureName));
  matchCache.set(featureName, result);
  return result;
}

/**
 * Is this polity held by an *enemy* belligerent in `year`?
 *
 * True only when the polity itself and its overlord resolve to *different sides of
 * the same active conflict*. Requiring both to resolve is what keeps this from
 * washing every colonial empire: "Belgian Congo [subject to: Belgium]" puts both
 * names on the same side, and "Madagascar (France)" has an overlord at war but a
 * polity no conflict names — neither is occupied territory in the sense drawn here.
 * The parenthetical the wartime snapshots append ("France (Germany)") is stripped
 * so the base polity is judged, not the occupier's name embedded in it.
 *
 * Memoised per year like isBelligerent above — this runs on the render path.
 */
let occupiedYear = -1;
let occupiedCache = new Map<string, boolean>();

export function isOccupiedByEnemy(
  featureName: string | null,
  subjectTo: string | null,
  year: number,
): boolean {
  if (!featureName || !subjectTo) return false;
  const y = Math.floor(year);
  if (y !== occupiedYear) {
    occupiedYear = y;
    occupiedCache = new Map();
  }
  const key = `${featureName}|${subjectTo}`;
  const hit = occupiedCache.get(key);
  if (hit !== undefined) return hit;

  const base = featureName.replace(/ \([^()]*\)$/, '');
  let result = false;
  for (const c of activeAt(y)) {
    const sideOf = (name: string) =>
      c.sides.findIndex(
        (s) => namesMatch(s.name, name) || (s.members ?? []).some((m) => namesMatch(m, name)),
      );
    const own = sideOf(base);
    const holder = sideOf(subjectTo);
    if (own >= 0 && holder >= 0 && own !== holder) {
      result = true;
      break;
    }
  }
  occupiedCache.set(key, result);
  return result;
}
