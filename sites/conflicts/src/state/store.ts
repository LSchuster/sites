import { useSyncExternalStore } from 'react';
import type { VizMode, ConflictType, HoveredCountry } from '../types.ts';

export interface AtlasState {
  /**
   * Fractional. Playback advances it by a fraction of a year per frame, so rounding
   * here would snap every increment back to the same integer and the animation would
   * sit still — which is exactly what it used to do. Round at the point of display.
   * Keeping it continuous also makes the border crossfade smooth rather than stepped.
   */
  year: number;
  playing: boolean;
  /** Years advanced per second during playback. */
  speed: number;
  selectedId: string | null;
  hoveredId: string | null;
  /**
   * The battle dot under the cursor, when no conflict bubble claims it. Setters
   * must keep the object identity stable while the same dot stays hovered —
   * setState's Object.is check is what stops a pointermove-rate re-render storm.
   */
  hoveredBattle: { name: string; year: number } | null;
  /** Screen position of the hovered mark, for the tooltip. Null when nothing is hovered. */
  hoverPos: [number, number] | null;
  hoveredCountry: HoveredCountry | null;
  /**
   * A clicked polity: pins the country card and outlines the territory.
   * Cleared by ocean click, Escape, the card's close button, or automatically
   * when the polity no longer exists in the snapshot in effect.
   */
  selectedCountry: HoveredCountry | null;
  vizMode: VizMode;
  typeFilter: Set<ConflictType> | null;
  query: string;
}

export const YEAR_MIN = 0;
export const YEAR_MAX = 2026;

let state: AtlasState = {
  year: 1914,
  playing: false,
  // 10 years/s — the 0.5× step of the speed control, its default.
  speed: 10,
  selectedId: null,
  hoveredId: null,
  hoveredBattle: null,
  hoverPos: null,
  hoveredCountry: null,
  selectedCountry: null,
  vizMode: 'absolute',
  typeFilter: null,
  query: '',
};

const listeners = new Set<() => void>();

export function getState(): AtlasState {
  return state;
}

export function setState(patch: Partial<AtlasState>): void {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof AtlasState)[]) {
    if (!Object.is(state[key], patch[key])) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Subscribe to a slice of state. Components must select narrowly — `year` changes
 * up to 60×/s during playback, and anything subscribed to it re-renders that often.
 * The map canvas deliberately does NOT use this; the renderer reads getState()
 * directly inside its rAF loop so drawing never goes through React.
 */
export function useAtlas<T>(selector: (s: AtlasState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

/** Clamp without rounding — see the note on AtlasState.year. */
export const clampYear = (y: number): number => Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));

/** The year as a reader sees it. */
export const displayYear = (y: number): number => Math.floor(y);
