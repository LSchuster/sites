import { dataUrl, loadJson } from './assets.ts';

/**
 * UCDP georeferenced event data, 1989–2024.
 *
 * Each record is 4 × Int32: year, lonIdx, latIdx, deaths — where lonIdx/latIdx are
 * grid indices at CELL degrees. Loaded as raw binary rather than JSON: 64,000
 * records would be ~2 MB of JSON text to parse, versus a 1 MB ArrayBuffer that
 * becomes a typed array for free.
 *
 * Deliberately not loaded until the timeline reaches 1989. Before that year this
 * data does not exist, and someone exploring antiquity should never pay for it.
 */

export const GED_START = 1989;

interface GedIndex {
  cell: number;
  minYear: number;
  maxYear: number;
  decades: number[];
}

let index: GedIndex | null = null;
let indexPending = false;
const decades = new Map<number, Int32Array>();
const loading = new Set<number>();

export interface GedCell {
  lon: number;
  lat: number;
  deaths: number;
}

function ensureIndex(): void {
  if (index || indexPending) return;
  indexPending = true;
  void loadJson<GedIndex>('ged/index.json').then((i) => {
    index = i;
  });
}

function ensureDecade(decade: number): void {
  if (decades.has(decade) || loading.has(decade)) return;
  loading.add(decade);
  void fetch(dataUrl(`ged/${decade}.bin`))
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
    .then((buf) => {
      decades.set(decade, new Int32Array(buf));
      loading.delete(decade);
    })
    .catch(() => loading.delete(decade));
}

/** Kick off whatever this year needs. Safe to call every frame. */
export function ensureGed(year: number): void {
  if (year < GED_START) return;
  ensureIndex();
  ensureDecade(Math.floor(year / 10) * 10);
}

export function gedCellSize(): number {
  return index?.cell ?? 0.25;
}

/** Cells with recorded deaths in `year`. Empty until the shard arrives. */
export function gedCells(year: number): GedCell[] {
  if (year < GED_START) return [];
  const data = decades.get(Math.floor(year / 10) * 10);
  if (!data) return [];
  const cell = gedCellSize();
  const out: GedCell[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== year) continue;
    out.push({
      lon: (data[i + 1] ?? 0) * cell,
      lat: (data[i + 2] ?? 0) * cell,
      deaths: data[i + 3] ?? 0,
    });
  }
  return out;
}
