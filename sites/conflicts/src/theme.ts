/**
 * The atlas palette — single source of truth for every colour in the project.
 *
 * Canvas drawing can't read CSS custom properties cheaply per frame, so the
 * values live here; src/theme-vars.ts injects them into `:root` once at
 * startup so the DOM chrome consumes the same values. styles.css keeps static
 * fallbacks only so the first paint before the module runs isn't unstyled —
 * never edit a colour there without changing it here.
 *
 * Encoding decisions (validated with the dataviz palette validator against the
 * map surface #0b1016):
 *  - Conflict magnitude → a SEQUENTIAL one-hue amber ramp, monotonic in lightness,
 *    every step ≥3:1 on the map surface. Size carries magnitude too; the redundant
 *    encoding is deliberate.
 *  - Opposing sides → the DIVERGING blue↔red pair. Two poles that read as
 *    opposition, worst-pair CVD ΔE 19.2 / normal-vision ΔE 29.0 on this surface.
 *  - Conflict *type* is never encoded as bubble hue: bubbles are an all-pairs form
 *    capped at three categorical slots, and there are seven types. Type lives in
 *    the detail panel and the filter row instead.
 */

/**
 * The map surface: a refined dark atlas.
 *
 * The ground is deep ink-navy — a night chart, not a dashboard. Territory is
 * tinted from the low-chroma TERRITORY range below (assigned per polity at
 * build time, adjacency-aware); the entire warm amber/red end of the spectrum
 * stays reserved for conflict data, which must remain the brightest warm thing
 * on the map.
 *
 * Coastlines are drawn brighter than internal borders. That single distinction
 * is what makes continents read as land rather than as a mesh of polygons.
 */
export const MAP = {
  /** The page behind the sphere — near-black, faintly blue. */
  page: '#06090f',
  /** Ocean gradient inside the sphere: centre → limb. */
  oceanInner: '#101c2b',
  oceanOuter: '#0a1220',
  land: '#232d3a',
  landHigh: '#2a3644',
  border: 'rgba(203,214,227,0.22)',
  /** Wide soft under-stroke beneath the crisp internal hairline. */
  borderSoft: 'rgba(10,16,26,0.20)',
  /** Boundaries the source itself rates approximate (precision ≥ 3). */
  borderFuzzy: 'rgba(203,214,227,0.13)',
  coast: 'rgba(201,215,232,0.55)',
  coastGlow: 'rgba(116,156,200,0.26)',
  graticule: 'rgba(200,215,235,0.04)',
  /** The plate edge: crisp neatline over a soft under-stroke, plus an inner rim. */
  sphere: 'rgba(203,217,236,0.30)',
  sphereSoft: 'rgba(150,180,215,0.10)',
  sphereRim: 'rgba(8,12,20,0.45)',
  /** Wash over polities named as belligerents in the current year. */
  belligerent: 'rgba(232,128,52,0.13)',
  belligerentEdge: 'rgba(255,160,80,0.34)',
  /**
   * Wash over polities held by an enemy belligerent — a deeper, denser step of the
   * same amber family (MAGNITUDE[1]), not a new hue: occupation is a conflict
   * intensity, and the warm end of the spectrum stays reserved for exactly that.
   */
  occupied: 'rgba(207,106,48,0.30)',
  occupiedEdge: 'rgba(232,128,52,0.38)',
  hover: 'rgba(255,214,160,0.14)',
  hoverEdge: 'rgba(255,214,160,0.75)',
  /** A clicked territory: firmer than hover, same warm ink family. */
  selected: 'rgba(255,214,160,0.10)',
  selectedEdge: 'rgba(255,222,178,0.95)',
  /** Halo behind canvas polity labels — deep ground ink, not pure black. */
  labelHalo: 'rgba(7,11,18,0.82)',
} as const;

/**
 * Muted per-polity territory tints — the hand-tint range of an old atlas.
 *
 * Seven low-chroma hues at near-identical lightness, all cool or neutral so
 * the amber conflict marks stay the loudest warm objects on the map. A build
 * step assigns one slot per polity (adjacency-aware, stable across snapshots);
 * features without an assignment fall back to MAP.land.
 */
export const TERRITORY = [
  '#2c3a4e', // slate blue
  '#263d40', // desaturated teal
  '#2e3d33', // gray-green
  '#3a3d2c', // muted olive
  '#3c3244', // dusty mauve
  '#2f3744', // steel
  '#3a362e', // warm gray
] as const;

/** Warm paper ink — text and linework, shared by canvas and DOM. */
export const INK = {
  primary: '#ece7db',
  secondary: '#b6aea1',
  muted: '#82796b',
  faint: '#4f4a40',
} as const;

/**
 * Typography. The display face is EB Garamond (OFL, subset in
 * src/assets/fonts) — canvas polity labels draw it as letterspaced capitals,
 * the atlas convention, because ctx.font cannot reach OpenType small caps.
 */
export const FONT = {
  display: '"EB Garamond", Georgia, "Times New Roman", serif',
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Sequential ramp for casualty magnitude. Low → high. */
export const MAGNITUDE = ['#b0562f', '#cf6a30', '#e88034', '#f79a4a', '#ffb972'] as const;

/** Diverging poles for opposing sides. */
export const SIDE = {
  a: '#3987e5',
  b: '#e66767',
  /** Civilians are not a "side" — they get a neutral, outside the divergence. */
  civilian: '#b6aea1',
  neutral: '#383835',
} as const;

/** Extra slots for multi-party conflicts (rare; most have two sides). */
export const SIDE_EXTRA = ['#d95926', '#199e70', '#c98500'] as const;

export const CONFIDENCE_LABEL: Record<string, string> = {
  documented: 'Documented',
  estimated: 'Estimated',
  disputed: 'Disputed',
};

export const PANEL = {
  surface: 'rgba(12,17,24,0.93)',
  raised: '#1b2431',
  hairline: 'rgba(226,219,204,0.10)',
  hairlineStrong: 'rgba(226,219,204,0.20)',
} as const;
