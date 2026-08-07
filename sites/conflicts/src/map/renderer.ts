import { zoomIdentity, type ZoomTransform } from 'd3-zoom';
import { geoContains, geoPath, type GeoProjection } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';
import { createPath, createProjection, GRATICULE } from './projection.ts';
import { MAP, TERRITORY } from '../theme.ts';
import { getPair, snapshotAt, type BorderSnapshot } from '../data/borders.ts';
import { getState, setState, displayYear } from '../state/store.ts';
import { activeAt, getConflicts, maxValue } from '../data/conflicts.ts';
import { isBelligerent, isOccupiedByEnemy } from '../data/involvement.ts';
import { worldPopulation } from '../data/population.ts';
import { conflictValue } from './scales.ts';
import { drawBubbles, type PlacedMark } from './layers/bubbles.ts';
import { LabelLayer } from './layers/labels.ts';
import { battleOpacity, BATTLE_ZOOM_IN, drawBattles, type PlacedBattle } from './layers/battles.ts';
import { battlesNear, ensureBattles } from '../data/battles.ts';
import { drawGed } from './layers/ged.ts';
import { ensureGed, gedCells, GED_START } from '../data/ged.ts';
import { getRelief } from './terrain.ts';
import { prefersReducedMotion } from '../motion.ts';
import type { BorderProps } from '../types.ts';

const SPHERE = { type: 'Sphere' } as const;

/** Seconds for a conflict mark to fade fully in or out. */
const FADE = 0.4;

/** Seconds for a war's ignition shockwave to expand and die. */
const IGNITE = 1.6;

/** How many years either side of the current one battle marks linger. */
const BATTLE_WINDOW = 4;

/** Overall strength of the relief embossing at continental zoom. */
const RELIEF_STRENGTH = 0.6;

/** Seconds for the relief plate to step in once it has arrived. */
const RELIEF_FADE = 0.6;

/** Rebakes the relief fade-in is quantised to. */
const RELIEF_STEPS = 5;

/**
 * Relief is a continental-scale device: at street-atlas zooms the raster would
 * dissolve into mush, so it fades out between k=4 and k=8.
 */
function reliefAlpha(k: number): number {
  if (k <= 4) return 1;
  if (k >= 8) return 0;
  return 1 - (k - 4) / 4;
}

/**
 * Zoom-tiered border weights. Strokes are constant screen-width (px() divides
 * by k), so these are the on-screen values: hairlines firm up slightly as the
 * reader closes in, and uncertain boundaries gain their dash only once there
 * is room to read it.
 */
function borderStyle(k: number): { internal: number; uncertain: number; dash: boolean } {
  if (k < 3) return { internal: 0.7, uncertain: 1.0, dash: false };
  if (k < 8) return { internal: 0.8, uncertain: 1.1, dash: true };
  return { internal: 0.9, uncertain: 1.2, dash: true };
}

/**
 * Milliseconds of stillness before we redraw the vector layers crisply.
 *
 * While the user is panning or zooming we reuse the last rasterised layers and
 * blit them with a delta transform. That is one drawImage per layer instead of
 * re-projecting every polygon in the world, and it is the difference between a
 * smooth drag and a slideshow. The brief softness while moving is invisible in
 * practice; the moment the gesture stops, everything sharpens.
 */
const SETTLE_MS = 90;

interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  key: string;
}

function makeLayer(): Layer {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx, key: '' };
}


export interface HoveredCountry {
  name: string | null;
  subjectTo: string | null;
  entity: number | null;
  at: [number, number];
}

/** Seconds for the hover wash to fade in or out. */
const HOVER_FADE = 0.15;

/**
 * The hover/selection fill washes out whole territories; at deep zoom a
 * single polity can fill the viewport and a constant-alpha wash reads as a
 * grey veil over everything. Thin it as the reader closes in — the edge line
 * keeps carrying the state.
 */
function hoverFillScale(k: number): number {
  return k <= 6 ? 1 : Math.max(0.35, 6 / k);
}

/**
 * Draws the atlas.
 *
 * Lives entirely outside React: the rAF loop reads the store directly and mutates
 * canvases, so scrubbing the timeline never triggers reconciliation.
 *
 * Border snapshots are crossfaded rather than vertex-interpolated. Morphing between
 * snapshots with different topologies (Rome → a dozen successor states) is not
 * well-defined and tears. Each snapshot renders to its own offscreen layer and the
 * later one dissolves in over the earlier — territory reforming reads as historical
 * change, and matches the source data's own advice to draw pre-modern borders fuzzy.
 */
export class AtlasRenderer {
  private baseCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private geoLayer = makeLayer(); // ocean + graticule + plate edge
  private layerA = makeLayer(); // earlier border snapshot
  private layerB = makeLayer(); // later border snapshot
  private tintLayer = makeLayer(); // belligerent wash over snapshot A
  /**
   * Belligerent wash over snapshot B, blitted at the crossfade mix like the
   * land itself. With one tint layer the wash was keyed to whichever snapshot
   * was "in effect" and popped to the new geometry at the halfway flip while
   * the ground beneath it was still dissolving.
   */
  private tintLayerB = makeLayer();
  private tintHasContent = false;
  private tintBHasContent = false;
  /**
   * The relief plate pre-warped to the current viewport, so each snapshot
   * rasterise embosses it with a cheap 1:1 drawImage. Warping the 2600px
   * plate inside every rasterise cost ~10 fps of playback in software
   * rendering; this layer re-warps only when the transform settles somewhere
   * new. Never composited directly — snapshot layers consume it.
   */
  private reliefLayer = makeLayer();

  private width = 0;
  private height = 0;
  private dpr = 1;

  private projection: GeoProjection;
  private transform: ZoomTransform = zoomIdentity;
  /** The transform the cached layers were rasterised at. */
  private bakedTransform: ZoomTransform = zoomIdentity;
  private lastTransformChange = 0;


  private raf = 0;
  private dirty = true;
  private lastKey = '';

  /** id → 0..1 entry animation. Conflicts fade in when their war begins. */
  private progress = new Map<string, number>();

  /**
   * id → 0..1 ignition shockwave, seeded when a war newly enters the visible
   * set (playback reaching its start year, or a scrub landing mid-war) and
   * dropped once the ring has fully expanded. Never seeded under
   * prefers-reduced-motion.
   */
  private ignition = new Map<string, number>();

  /**
   * Stepped fade-in for the relief plate: 0..1 advanced per frame, quantised
   * to RELIEF_STEPS rebakes so the arrival is gentle without re-rasterising
   * every frame. Steps only land while the view is settled and not playing.
   */
  private reliefFade = 0;
  private reliefStep = 0;
  private marks: PlacedMark[] = [];
  private battleMarks: PlacedBattle[] = [];
  private lastTime = 0;

  private labels = new LabelLayer();

  private hovered: HoveredCountry | null = null;
  private hoveredFeature: Feature<Geometry, BorderProps> | null = null;
  private onCountryChange: ((c: HoveredCountry | null) => void) | null = null;

  /** name → animated hover wash; entries fade out and are then dropped. */
  private hoverAnim = new Map<
    string,
    { feature: Feature<Geometry, BorderProps>; progress: number; dir: 1 | -1 }
  >();

  /** Resolved feature for the selected country, cached per snapshot+selection. */
  private selFeature: Feature<Geometry, BorderProps> | null = null;
  private selSnapshot: BorderSnapshot | null = null;
  private selRef: HoveredCountry | null = null;

  constructor(
    private base: HTMLCanvasElement,
    private overlay: HTMLCanvasElement,
  ) {
    const bctx = base.getContext('2d');
    const octx = overlay.getContext('2d');
    if (!bctx || !octx) throw new Error('2D canvas unavailable');
    this.baseCtx = bctx;
    this.overlayCtx = octx;
    this.projection = createProjection(1, 1);
  }

  setCountryListener(fn: (c: HoveredCountry | null) => void): void {
    this.onCountryChange = fn;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    const layers = [
      this.geoLayer,
      this.layerA,
      this.layerB,
      this.tintLayer,
      this.tintLayerB,
      this.reliefLayer,
    ];
    for (const c of [this.base, this.overlay, ...layers.map((l) => l.canvas)]) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    this.base.style.width = `${width}px`;
    this.base.style.height = `${height}px`;
    this.overlay.style.width = `${width}px`;
    this.overlay.style.height = `${height}px`;
    this.projection = createProjection(width, height);
    for (const l of layers) l.key = '';
    this.dirty = true;
  }

  setTransform(t: ZoomTransform): void {
    this.transform = t;
    this.lastTransformChange = performance.now();
    // Deliberately NOT setting `dirty`. `dirty` means "the content changed, re-raster
    // the vector layers"; a moved viewport only means "re-composite what we already
    // have". Setting it here forced a full rebake on every frame of a drag, which
    // pinned panning at 15fps while everything else ran at 60.
  }

  getTransform(): ZoomTransform {
    return this.transform;
  }

  invalidate(): void {
    this.dirty = true;
    const layers = [
      this.geoLayer,
      this.layerA,
      this.layerB,
      this.tintLayer,
      this.tintLayerB,
      this.reliefLayer,
    ];
    for (const l of layers) l.key = '';
  }

  start(): void {
    if (this.raf) return;
    const tick = () => {
      this.frame();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Screen point → [lon, lat], accounting for pan and zoom. */
  private toLonLat(sx: number, sy: number): [number, number] | null {
    const { x, y, k } = this.transform;
    const inverted = this.projection.invert?.([(sx - x) / k, (sy - y) / k]);
    if (!inverted || !Number.isFinite(inverted[0]) || !Number.isFinite(inverted[1])) return null;
    return [inverted[0], inverted[1]];
  }

  /** Which conflict, if any, sits under a screen point. Nearest centre wins. */
  hitTest(sx: number, sy: number): string | null {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const m of this.marks) {
      const d = Math.hypot(m.x - sx, m.y - sy);
      if (d <= m.r && d < bestDist) {
        bestDist = d;
        best = m.id;
      }
    }
    return best;
  }

  /**
   * Which battle dot, if any, sits under a screen point. The marks are only the
   * ±window-year subset drawn this frame — tens of dots — and this runs on the
   * rAF-coalesced hover path, so a linear scan is the right tool. The dots are
   * tiny, so the grab radius is padded to stay hoverable.
   */
  hitTestBattle(sx: number, sy: number): PlacedBattle | null {
    let best: PlacedBattle | null = null;
    let bestDist = Infinity;
    for (const m of this.battleMarks) {
      const d = Math.hypot(m.x - sx, m.y - sy);
      if (d <= Math.max(m.r + 3, 6) && d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  /**
   * Which country is under the cursor.
   *
   * Runs on pointermove, not per frame. `geoContains` is a proper spherical
   * point-in-polygon so it stays correct across the antimeridian and at the poles,
   * where a planar test would quietly give wrong answers.
   */
  hitTestCountry(sx: number, sy: number): HoveredCountry | null {
    const point = this.toLonLat(sx, sy);
    if (!point) return null;
    const snapshot = snapshotAt(getState().year);
    if (!snapshot) return null;

    let fallback: HoveredCountry | null = null;
    for (const f of snapshot.fc.features) {
      if (!geoContains(f, point)) continue;
      const props = f.properties;
      const hit: HoveredCountry = {
        name: props?.name ?? null,
        subjectTo: props?.subjectTo ?? null,
        entity: props?.entity ?? null,
        at: point,
      };
      // Unnamed features are unclaimed land; keep looking for a named polity
      // covering the same point before settling for one.
      if (hit.name) {
        this.hoveredFeature = f;
        return hit;
      }
      fallback ??= hit;
    }
    this.hoveredFeature = null;
    return fallback;
  }

  setHoveredCountry(c: HoveredCountry | null): void {
    const prev = this.hovered?.name ?? null;
    const next = c?.name ?? null;
    if (prev !== next) {
      // The wash animates: the departing territory eases out while the new
      // one eases in, both driven from advanceAnimations.
      if (prev) {
        const leaving = this.hoverAnim.get(prev);
        if (leaving) leaving.dir = -1;
      }
      if (next && this.hoveredFeature) {
        const entering = this.hoverAnim.get(next);
        if (entering) {
          entering.dir = 1;
          entering.feature = this.hoveredFeature;
        } else {
          this.hoverAnim.set(next, { feature: this.hoveredFeature, progress: 0, dir: 1 });
        }
      }
      this.onCountryChange?.(c);
    }
    this.hovered = c;
    if (!c) this.hoveredFeature = null;
  }

  /** Apply device pixel ratio + zoom so paths draw crisp at any zoom level. */
  private applyTransform(ctx: CanvasRenderingContext2D, t: ZoomTransform): void {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);
  }

  private px(v: number, t: ZoomTransform): number {
    return v / t.k;
  }

  private sig(t: ZoomTransform): string {
    return `${t.k.toFixed(4)}:${t.x.toFixed(1)}:${t.y.toFixed(1)}`;
  }

  /**
   * The ground: ocean, graticule, plate edge. Rasterised into geoLayer, so it
   * pans and zooms with the same blit as every other layer.
   */
  private renderGeo(t: ZoomTransform): void {
    const key = `geo:${this.sig(t)}`;
    if (this.geoLayer.key === key) return;
    const { ctx, canvas } = this.geoLayer;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.applyTransform(ctx, t);
    const path = createPath(this.projection, ctx);

    // Ocean: a radial depth gradient anchored to the sphere itself, not the
    // viewport. The context is already in map space here, so the gradient is
    // baked into the layer and panning carries the deep water with the map —
    // the previous screen-space gradient stayed glued to the window centre
    // while the world moved beneath it.
    const [[x0, y0], [x1, y1]] = geoPath(this.projection).bounds(SPHERE);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const radius = Math.max(x1 - x0, y1 - y0) / 2;
    const ocean = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.02);
    ocean.addColorStop(0, MAP.oceanInner);
    ocean.addColorStop(1, MAP.oceanOuter);
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = ocean;
    ctx.fill();

    ctx.beginPath();
    path(GRATICULE);
    ctx.strokeStyle = MAP.graticule;
    ctx.lineWidth = this.px(0.6, t);
    ctx.stroke();

    // Inner rim: the ocean darkens toward the limb, clipped so the shading
    // stays inside the plate.
    ctx.save();
    ctx.beginPath();
    path(SPHERE);
    ctx.clip();
    ctx.beginPath();
    path(SPHERE);
    ctx.strokeStyle = MAP.sphereRim;
    ctx.lineWidth = this.px(30, t);
    ctx.stroke();
    ctx.restore();

    // Plate edge: a soft wide under-stroke beneath a crisp neatline.
    ctx.beginPath();
    path(SPHERE);
    ctx.strokeStyle = MAP.sphereSoft;
    ctx.lineWidth = this.px(4.5, t);
    ctx.stroke();

    ctx.beginPath();
    path(SPHERE);
    ctx.strokeStyle = MAP.sphere;
    ctx.lineWidth = this.px(1, t);
    ctx.stroke();

    this.geoLayer.key = key;
  }

  /**
   * Warp the relief plate to the current viewport. Both the plate's reference
   * frame and the live projection are Equal Earth, and fitExtent/fitWidth only
   * ever change scale and translate — so the warp is one affine drawImage
   * (see pipeline/8-terrain.ts and src/map/terrain.ts).
   */
  private renderRelief(t: ZoomTransform): void {
    const relief = getRelief();
    if (!relief || reliefAlpha(t.k) <= 0) return;
    const key = `relief:${this.sig(t)}`;
    if (this.reliefLayer.key === key) return;
    const { ctx, canvas } = this.reliefLayer;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.applyTransform(ctx, t);
    const rs = this.projection.scale() / relief.scale;
    const [ltx, lty] = this.projection.translate();
    ctx.translate(ltx - relief.translate[0] * rs, lty - relief.translate[1] * rs);
    ctx.scale(rs, rs);
    ctx.drawImage(relief.bitmap, 0, 0);
    this.reliefLayer.key = key;
  }

  /**
   * One snapshot: land fill, internal borders, coastline.
   *
   * Three path operations rather than one per feature. Stroking each feature
   * separately drew every shared border twice and cost ~750 path calls per redraw;
   * the TopoJSON meshes collapse that to two strokes and let the coast be brighter
   * than the interior, which is what gives the continents their edge.
   */
  private renderSnapshot(layer: Layer, snapshot: BorderSnapshot, key: string, t: ZoomTransform): void {
    if (layer.key === key) return;
    const { ctx, canvas } = layer;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.applyTransform(ctx, t);
    const path = createPath(this.projection, ctx);

    // Land, one feature at a time.
    //
    // Filling the whole FeatureCollection as a single path is tempting and wrong:
    // with the nonzero winding rule the rings of circumpolar Antarctica combine
    // with everything else and the fill floods the entire sphere. Per-feature fills
    // keep each polygon's winding to itself. The cost is fine because this layer is
    // rasterised only when the snapshot or the viewport changes, not per frame.
    for (const f of snapshot.fc.features) {
      const slot = f.properties?.color;
      ctx.fillStyle = slot != null ? (TERRITORY[slot] ?? MAP.land) : MAP.land;
      ctx.beginPath();
      path(f);
      ctx.fill();
    }

    // Emboss the shaded-relief plate into the land just filled. source-atop
    // clips it to this snapshot's own landmass, so the relief crossfades and
    // pans with the layer for free. The plate is consumed via reliefLayer —
    // already warped to this viewport — so this is a 1:1 drawImage.
    const embossAlpha =
      reliefAlpha(t.k) * RELIEF_STRENGTH * (this.reliefStep / RELIEF_STEPS);
    if (embossAlpha > 0.01 && this.reliefLayer.key === `relief:${this.sig(t)}`) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = embossAlpha;
      ctx.drawImage(this.reliefLayer.canvas, 0, 0);
      ctx.restore();
    }

    // The engraved border stack, all within this layer so the crossfade can
    // never double-expose it: a soft dark under-stroke gives the hairline a
    // groove to sit in; uncertain boundaries — the source's own precision
    // rating — draw softer, gaining a dash only once zoom gives it room; the
    // coast gets a wide glow beneath a crisp bright line, which is what makes
    // continents read as land.
    const bs = borderStyle(t.k);
    ctx.lineJoin = 'round';

    ctx.beginPath();
    path(snapshot.internal);
    ctx.strokeStyle = MAP.borderSoft;
    ctx.lineWidth = this.px(2.4, t);
    ctx.stroke();

    ctx.beginPath();
    path(snapshot.internalUncertain);
    ctx.strokeStyle = MAP.borderFuzzy;
    ctx.lineWidth = this.px(bs.uncertain, t);
    if (bs.dash) ctx.setLineDash([this.px(4, t), this.px(3, t)]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    path(snapshot.internal);
    ctx.strokeStyle = MAP.border;
    ctx.lineWidth = this.px(bs.internal, t);
    ctx.stroke();

    ctx.beginPath();
    path(snapshot.coast);
    ctx.strokeStyle = MAP.coastGlow;
    ctx.lineWidth = this.px(2.8, t);
    ctx.stroke();

    ctx.beginPath();
    path(snapshot.coast);
    ctx.strokeStyle = MAP.coast;
    ctx.lineWidth = this.px(1.0, t);
    ctx.stroke();

    layer.key = key;
  }

  /**
   * Wash over polities named as belligerents this year.
   *
   * Keyed on the *set of matched countries*, not on the year. The set only changes
   * when a war starts or ends — perhaps a dozen times across two millennia — whereas
   * the year ticks over twenty times a second during playback. Keying on the year
   * re-rasterised this layer constantly and was the sole source of dropped frames
   * during playback.
   */
  private renderTint(
    layer: Layer,
    snapshot: BorderSnapshot | null,
    snapshotYear: number,
    year: number,
    t: ZoomTransform,
  ): boolean {
    const y = displayYear(year);
    // Occupied territory gets its own deeper wash and wins over the plain
    // belligerent one — German-held France must not read like fighting France.
    const matched: Feature<Geometry, BorderProps>[] = [];
    const occupied: Feature<Geometry, BorderProps>[] = [];
    for (const f of snapshot?.fc.features ?? []) {
      const name = f.properties?.name ?? null;
      if (isOccupiedByEnemy(name, f.properties?.subjectTo ?? null, y)) occupied.push(f);
      else if (isBelligerent(name, y)) matched.push(f);
    }
    const any = matched.length > 0 || occupied.length > 0;
    // Keyed on the snapshot year (changes only at gap crossings) and the
    // matched sets — NEVER on the display year, which ticks twenty times a
    // second during playback and once made this layer the sole source of
    // dropped frames.
    const key =
      `tint:${snapshotYear}:${this.sig(t)}:${matched.map((f) => f.properties?.name).join('|')}` +
      `:${occupied.map((f) => f.properties?.name).join('|')}`;
    if (layer.key === key) return any;

    const { ctx, canvas } = layer;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    layer.key = key;
    if (!any) return false;

    this.applyTransform(ctx, t);
    const path = createPath(this.projection, ctx);

    ctx.lineWidth = this.px(0.9, t);
    ctx.fillStyle = MAP.belligerent;
    ctx.strokeStyle = MAP.belligerentEdge;
    for (const f of matched) {
      ctx.beginPath();
      path(f);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = MAP.occupied;
    ctx.strokeStyle = MAP.occupiedEdge;
    for (const f of occupied) {
      ctx.beginPath();
      path(f);
      ctx.fill();
      ctx.stroke();
    }
    return true;
  }

  /**
   * Blit a cached layer that was rasterised at `baked` into the current transform.
   * Exact for panning; for zooming it scales the raster, which is briefly soft but
   * costs one drawImage instead of re-projecting the world.
   */
  private blit(layer: Layer, alpha: number): void {
    const ctx = this.baseCtx;
    const cur = this.transform;
    const baked = this.bakedTransform;
    ctx.globalAlpha = alpha;
    if (cur === baked || (cur.k === baked.k && cur.x === baked.x && cur.y === baked.y)) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      const s = cur.k / baked.k;
      ctx.setTransform(
        s,
        0,
        0,
        s,
        (cur.x - baked.x * s) * this.dpr,
        (cur.y - baked.y * s) * this.dpr,
      );
    }
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  private drawBase(rebake: boolean): void {
    const ctx = this.baseCtx;
    const { width, height, dpr } = this;
    const year = getState().year;
    const { a, b, mix, yearA, yearB } = getPair(year);

    if (rebake) {
      const t = this.transform;
      this.renderGeo(t);
      this.renderRelief(t);
      // Keys carry the snapshot *year*, not the feature count: adjacent wartime
      // snapshots share a count (1941–43 are all 251 features) and a count-based
      // key would silently keep a stale raster across those crossings.
      const keyA = `s:${yearA}:${this.sig(t)}:r${this.reliefStep}`;
      const keyB = `s:${yearB}:${this.sig(t)}:r${this.reliefStep}`;
      // At a gap crossing the layer the playhead just left already holds the
      // raster the other slot now needs — swap the layers instead of re-projecting
      // the whole world twice. With 1-year gaps through 1938–45 those crossings
      // are dense enough during playback that the double raster showed as spikes.
      if (this.layerA.key !== keyA && this.layerB.key !== keyB) {
        if (this.layerB.key === keyA || this.layerA.key === keyB) {
          const tmp = this.layerA;
          this.layerA = this.layerB;
          this.layerB = tmp;
        }
      }
      if (a) this.renderSnapshot(this.layerA, a, keyA, t);
      if (b && b !== a) this.renderSnapshot(this.layerB, b, keyB, t);
      // Tint follows the ground: A's wash rides at full alpha, B's dissolves
      // in at the same mix as its geometry.
      this.tintHasContent = this.renderTint(this.tintLayer, a, yearA, year, t);
      this.tintBHasContent =
        b && b !== a ? this.renderTint(this.tintLayerB, b, yearB, year, t) : false;
      this.bakedTransform = t;
    }

    // The page behind the sphere. The ocean itself lives inside geoLayer now,
    // anchored to the map; only this flat page colour is screen-space.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = MAP.page;
    ctx.fillRect(0, 0, width, height);

    this.blit(this.geoLayer, 1);

    // The earlier snapshot goes down at FULL opacity and the later one dissolves in
    // on top. The obvious alternative — A at (1-mix), B at mix — is wrong: the
    // second drawImage dilutes the first, so mid-crossfade the land ends up only
    // ~77% opaque and ocean bleeds through, which made mid-era years look washed out.
    if (a) this.blit(this.layerA, 1);
    if (b && b !== a && mix > 0) this.blit(this.layerB, mix);
    if (this.tintHasContent) this.blit(this.tintLayer, 1);
    if (this.tintBHasContent && mix > 0) this.blit(this.tintLayerB, mix);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private advanceAnimations(dt: number, year: number, settled: boolean): void {
    const active = new Set(activeAt(year).map((c) => c.id));
    // Reduced motion: marks appear and vanish in a single frame.
    const reduced = prefersReducedMotion();
    const step = reduced ? 1 : dt / FADE;
    for (const id of active) {
      const prev = this.progress.get(id);
      // A war entering the visible set ignites: one expanding shockwave ring.
      if (prev === undefined && !reduced) this.ignition.set(id, 0);
      this.progress.set(id, Math.min(1, (prev ?? 0) + step));
    }
    for (const [id, value] of this.progress) {
      if (active.has(id)) continue;
      const next = value - step;
      if (next <= 0) this.progress.delete(id);
      else this.progress.set(id, next);
    }
    for (const [id, value] of this.ignition) {
      const next = value + dt / IGNITE;
      if (next >= 1 || !active.has(id)) this.ignition.delete(id);
      else this.ignition.set(id, next);
    }

    // Hover washes ease in and out; fully-departed entries are dropped.
    const hoverStep = prefersReducedMotion() ? 1 : dt / HOVER_FADE;
    for (const [name, anim] of this.hoverAnim) {
      anim.progress += anim.dir * hoverStep;
      if (anim.progress >= 1) anim.progress = 1;
      if (anim.progress <= 0) this.hoverAnim.delete(name);
    }

    // Relief fade-in: advance the clock every frame, but only land a rebake
    // step while the view is settled and playback is paused — a rebake during
    // a drag or a playback crossing would show as a hitch.
    if (this.reliefStep < RELIEF_STEPS && getRelief()) {
      this.reliefFade = prefersReducedMotion()
        ? 1
        : Math.min(1, this.reliefFade + dt / RELIEF_FADE);
      const target = Math.round(this.reliefFade * RELIEF_STEPS);
      if (target !== this.reliefStep && settled && !getState().playing) {
        this.reliefStep = target;
        this.dirty = true;
      }
    }
  }

  /**
   * The selected country's feature in the snapshot currently in effect,
   * resolved by entity id first (survives renames across snapshots), name as
   * fallback. Cached per (selection, snapshot); when the polity no longer
   * exists the selection clears itself.
   */
  private resolveSelected(sel: HoveredCountry | null): Feature<Geometry, BorderProps> | null {
    if (!sel) return null;
    const snapshot = snapshotAt(getState().year);
    if (!snapshot) return null;
    if (sel === this.selRef && snapshot === this.selSnapshot) return this.selFeature;
    this.selRef = sel;
    this.selSnapshot = snapshot;
    let found: Feature<Geometry, BorderProps> | null = null;
    if (sel.entity != null) {
      found = snapshot.fc.features.find((f) => f.properties?.entity === sel.entity) ?? null;
    }
    found ??= sel.name
      ? (snapshot.fc.features.find((f) => f.properties?.name === sel.name) ?? null)
      : null;
    this.selFeature = found;
    if (!found) setState({ selectedCountry: null });
    return found;
  }

  private drawHoverOutline(settled: boolean): void {
    // Re-projecting country outlines every frame of a drag is pure waste — the
    // cursor isn't meaningfully over anything while the map is moving under it.
    if (!settled) return;
    const ctx = this.overlayCtx;
    const t = this.transform;
    const fillScale = hoverFillScale(t.k);

    const selected = this.resolveSelected(getState().selectedCountry);
    if (selected || this.hoverAnim.size) {
      this.applyTransform(ctx, t);
      const path = createPath(this.projection, ctx);
      ctx.lineJoin = 'round';

      if (selected) {
        ctx.beginPath();
        path(selected);
        ctx.globalAlpha = fillScale;
        ctx.fillStyle = MAP.selected;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = MAP.selectedEdge;
        ctx.lineWidth = this.px(1.7, t);
        ctx.stroke();
      }

      for (const anim of this.hoverAnim.values()) {
        if (anim.feature === selected) continue;
        const eased = 1 - Math.pow(1 - Math.max(0, Math.min(1, anim.progress)), 3);
        if (eased <= 0.01) continue;
        ctx.beginPath();
        path(anim.feature);
        ctx.globalAlpha = eased * fillScale;
        ctx.fillStyle = MAP.hover;
        ctx.fill();
        ctx.globalAlpha = eased;
        ctx.strokeStyle = MAP.hoverEdge;
        ctx.lineWidth = this.px(1.2, t);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  /** Draw a single frame synchronously, outside the rAF loop (headless checks). */
  renderOnce(): void {
    this.frame();
  }

  private frame(): void {
    const now = performance.now();
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0;
    this.lastTime = now;

    const { year, vizMode, hoveredId, selectedId, typeFilter } = getState();
    const { a, b, mix, yearA, yearB } = getPair(year);

    const settled = now - this.lastTransformChange > SETTLE_MS;
    const moved = this.sig(this.transform) !== this.sig(this.bakedTransform);
    // Rebake when the viewport has settled somewhere new, or when the content
    // itself changed (a snapshot arrived, the year rolled over).
    const contentKey = `${displayYear(year)}|${mix.toFixed(3)}|${a ? 1 : 0}${b ? 1 : 0}`;
    const needRebake = (moved && settled) || (!moved && contentKey !== this.lastKey) || this.dirty;

    if (needRebake || moved || contentKey !== this.lastKey) {
      this.drawBase(needRebake);
      this.lastKey = contentKey;
      this.dirty = false;
    }

    this.advanceAnimations(dt, year, settled);

    const octx = this.overlayCtx;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    octx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.drawHoverOutline(settled);

    // Modern event field, beneath everything else. Only exists from 1989.
    if (year >= GED_START) {
      ensureGed(year);
      drawGed(octx, {
        cells: gedCells(displayYear(year)),
        projection: this.projection,
        transform: this.transform,
        dpr: this.dpr,
        opacity: 1,
      });
    }

    // Polity labels: placement recomputes only at settle or when the snapshot
    // pair changes (place() no-ops on a matching key); drawing tracks the
    // live transform every frame like the layer blits do.
    if (settled || !moved) {
      this.labels.place(a, b, yearA, yearB, this.projection, this.transform, this.dpr);
    }
    this.labels.draw(
      octx,
      this.transform,
      this.dpr,
      b && b !== a ? mix : 0,
      prefersReducedMotion() ? 0 : dt,
    );

    // Battle marks sit beneath the conflict bubbles and only once zoomed in.
    // They get the *fractional* year: the flare and ripple animate from it,
    // and the integer display year would step them once per year instead of
    // once per frame.
    const bo = battleOpacity(this.transform.k);
    if (this.transform.k > BATTLE_ZOOM_IN) ensureBattles();
    if (bo > 0) {
      this.battleMarks = drawBattles(octx, {
        battles: battlesNear(year, BATTLE_WINDOW),
        projection: this.projection,
        transform: this.transform,
        year,
        window: BATTLE_WINDOW,
        opacity: bo,
        dpr: this.dpr,
      });
    } else if (this.battleMarks.length) {
      // Zoomed back out: without this reset, stale marks would keep answering
      // hit tests for dots that are no longer drawn.
      this.battleMarks = [];
    }

    const visible = getConflicts().filter(
      (c) => this.progress.has(c.id) && (!typeFilter || typeFilter.has(c.type)),
    );

    this.marks = drawBubbles(octx, {
      conflicts: visible,
      projection: this.projection,
      transform: this.transform,
      mode: vizMode,
      max: maxValue(vizMode),
      progress: this.progress,
      ignition: this.ignition,
      time: now / 1000,
      valueOf: (c) => conflictValue(c, vizMode, worldPopulation),
      hoveredId,
      selectedId,
      dpr: this.dpr,
    });
  }
}
