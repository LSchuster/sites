import { useSyncExternalStore } from 'react';
import { loadJson } from './assets.ts';
import { conflictValue, isActive } from '../map/scales.ts';
import { worldPopulation } from './population.ts';
import type { Conflict, VizMode } from '../types.ts';

let all: Conflict[] = [];
let loaded = false;
const listeners = new Set<() => void>();

/** Largest value in each mode — the anchor the radius scale normalises against. */
const maxima: Record<VizMode, number> = { absolute: 1, population: 1 };

export async function initConflicts(): Promise<Conflict[]> {
  if (loaded) return all;
  all = await loadJson<Conflict[]>('conflicts.json');
  loaded = true;

  for (const mode of ['absolute', 'population'] as VizMode[]) {
    maxima[mode] = all.reduce(
      (m, c) => Math.max(m, conflictValue(c, mode, worldPopulation)),
      1,
    );
  }

  for (const fn of listeners) fn();
  return all;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Re-renders a component once the dataset arrives.
 *
 * Components that read maxValue() or getConflicts() during render need this —
 * without it they compute against an empty dataset at mount and never update.
 * (The map canvas doesn't: its rAF loop re-reads every frame.)
 */
export function useConflictsLoaded(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => loaded,
  );
}

export function getConflicts(): Conflict[] {
  return all;
}

export function isLoaded(): boolean {
  return loaded;
}

export function maxValue(mode: VizMode): number {
  return maxima[mode];
}

export function getById(id: string | null): Conflict | null {
  if (!id) return null;
  return all.find((c) => c.id === id) ?? null;
}

/**
 * A conflict's display strings in the active locale, falling back per field.
 * A language with names translated but not summaries shows German titles above
 * English prose, which is a better failure than an empty panel.
 */
export function localized(
  c: Conflict,
  locale: string,
): { name: string; region: string; summary: string | undefined } {
  const tr = c.i18n?.[locale];
  return {
    name: tr?.name ?? c.name,
    region: tr?.region ?? c.region,
    summary: tr?.summary ?? c.summary,
  };
}

export function localizedSide(c: Conflict, index: number, locale: string): string {
  return c.i18n?.[locale]?.sides?.[index] ?? c.sides[index]?.name ?? '';
}

export function localizedMembers(c: Conflict, index: number, locale: string): string[] {
  return c.i18n?.[locale]?.members?.[index] ?? c.sides[index]?.members ?? [];
}

/** Conflicts under way in a given year. 95 records — a linear scan is free. */
export function activeAt(year: number): Conflict[] {
  return all.filter((c) => isActive(c, year));
}

/**
 * Case-insensitive search across names, regions and belligerents.
 *
 * Searches both the English original and the active translation, so a German
 * reader finds "Zweiter Weltkrieg" while someone typing "World War" still gets a
 * hit — useful because English names are what most external references use.
 */
export function search(query: string, locale: string, limit = 8): Conflict[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: { c: Conflict; rank: number }[] = [];
  for (const c of all) {
    const tr = c.i18n?.[locale];
    const names = [c.name, tr?.name].filter(Boolean).map((n) => n!.toLowerCase());
    const regions = [c.region, tr?.region].filter(Boolean).map((n) => n!.toLowerCase());
    const sides = [
      ...c.sides.map((s) => s.name),
      ...(tr?.sides ?? []),
      ...c.sides.flatMap((s) => s.members ?? []),
      ...(tr?.members?.flatMap((a) => a ?? []) ?? []),
    ].map((n) => n.toLowerCase());

    let rank = -1;
    if (names.some((n) => n.startsWith(q))) rank = 0;
    else if (names.some((n) => n.includes(q))) rank = 1;
    else if (regions.some((n) => n.includes(q))) rank = 2;
    else if (sides.some((n) => n.includes(q))) rank = 3;
    if (rank >= 0) hits.push({ c, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || b.c.total.best - a.c.total.best);
  return hits.slice(0, limit).map((h) => h.c);
}
