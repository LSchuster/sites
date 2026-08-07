import type { GeoProjection } from 'd3-geo';
import type { ZoomTransform } from 'd3-zoom';
import type { Battle } from '../../data/battles.ts';
import { prefersReducedMotion } from '../../motion.ts';

const TAU = Math.PI * 2;

/** Zoom level at which battle marks begin to appear, and where they reach full strength. */
export const BATTLE_ZOOM_IN = 1.8;
const BATTLE_ZOOM_FULL = 3.2;

/**
 * Warm ember tones — the same amber family as the conflict marks, one register
 * quieter. The old cool-white dots read as map furniture; these read as what
 * they are, the fine sparks of the wars above them.
 */
const CORE = '255, 216, 168';
const EMBER = '255, 176, 102';

/** Years either side of a battle's date during which it flares and ripples. */
const HEAT_SPAN = 1.25;

/** 0 at the world view, 1 once zoomed in enough to want individual engagements. */
export function battleOpacity(k: number): number {
  if (k <= BATTLE_ZOOM_IN) return 0;
  return Math.min(1, (k - BATTLE_ZOOM_IN) / (BATTLE_ZOOM_FULL - BATTLE_ZOOM_IN));
}

/** A battle dot as actually drawn this frame, in screen coordinates. */
export interface PlacedBattle {
  name: string;
  year: number;
  x: number;
  y: number;
  r: number;
}

/** Four tapered rays — a spark, the atlas glyph for an engagement in progress. */
function sparkPath(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, w: number): void {
  ctx.moveTo(x - R, y);
  ctx.lineTo(x, y - w);
  ctx.lineTo(x + R, y);
  ctx.lineTo(x, y + w);
  ctx.closePath();
  ctx.moveTo(x, y - R);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + R);
  ctx.lineTo(x - w, y);
  ctx.closePath();
}

/**
 * Individual engagements — the texture layer beneath the curated conflicts.
 *
 * Embers rather than furniture: each battle is a warm core in a soft glow that
 * fades with its distance in time from the current year. In the year it is
 * actually fought it flares into a four-point spark and, as the playhead moves
 * past, sheds one expanding ripple — so playback reads as fire moving across
 * the map. Still subordinate to the conflict bubbles: tighter radii, quieter
 * alpha, no competition for the magnitude encoding.
 *
 * `year` should be the *fractional* store year — the flare and ripple animate
 * from it, and an integer year would step them per year instead of per frame.
 *
 * Returns the visible dots so the hover path can hit-test exactly what was drawn.
 */
export function drawBattles(
  ctx: CanvasRenderingContext2D,
  opts: {
    battles: Battle[];
    projection: GeoProjection;
    transform: ZoomTransform;
    year: number;
    window: number;
    opacity: number;
    dpr: number;
  },
): PlacedBattle[] {
  const { battles, projection, transform, year, window, opacity, dpr } = opts;
  const placed: PlacedBattle[] = [];
  if (opacity <= 0.01 || !battles.length) return placed;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = ctx.canvas.width / dpr;
  const h = ctx.canvas.height / dpr;
  const reduced = prefersReducedMotion();

  for (const b of battles) {
    const p = projection([b.lon, b.lat]);
    if (!p) continue;
    const x = p[0] * transform.k + transform.x;
    const y = p[1] * transform.k + transform.y;
    // The glow gradients below are the cost of this layer; zoomed in, most of
    // the ±window set is off-screen, so cull before spending anything on it.
    if (x < -32 || y < -32 || x > w + 32 || y > h + 32) continue;

    // Fade with temporal distance: this year is brightest, ±window is invisible.
    const dy = Math.abs(b.year - year);
    const age = 1 - dy / (window + 1);
    const alpha = opacity * Math.max(0, age);
    if (alpha <= 0.02) continue;

    // Larger engagements get a slightly bigger dot, but the range is tight —
    // magnitude is the conflict layer's job.
    const r = b.deaths > 0 ? 2.1 + Math.min(2.6, Math.log10(b.deaths) * 0.6) : 2.1;

    // Ember glow beneath the core.
    if (alpha > 0.08) {
      const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3.2);
      glow.addColorStop(0, `rgba(${EMBER}, ${alpha * 0.4})`);
      glow.addColorStop(1, `rgba(${EMBER}, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, TAU);
      ctx.fillStyle = glow;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = `rgba(${CORE}, ${alpha * 0.92})`;
    ctx.fill();

    const heat = Math.max(0, 1 - dy / HEAT_SPAN);
    if (heat > 0) {
      // The battle is being fought "now": flare into a spark…
      const he = heat * heat * (3 - 2 * heat); // smoothstep
      ctx.beginPath();
      sparkPath(ctx, x, y, r * (1.7 + 1.8 * he), r * 0.55);
      ctx.fillStyle = `rgba(${CORE}, ${alpha * 0.85 * he})`;
      ctx.fill();

      // …and shed one ripple as the playhead moves past. Pure motion, so it
      // collapses to nothing under prefers-reduced-motion (the spark stays —
      // it is state, not animation).
      if (!reduced) {
        const ripple = dy / HEAT_SPAN;
        ctx.beginPath();
        ctx.arc(x, y, r + 1.5 + ripple * 14, 0, TAU);
        ctx.strokeStyle = `rgba(${EMBER}, ${alpha * 0.5 * (1 - ripple)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else if (age > 0.85) {
      // Recent but no longer hot: a faint halo ring marks "fresh".
      ctx.beginPath();
      ctx.arc(x, y, r + 2.5, 0, TAU);
      ctx.strokeStyle = `rgba(${CORE}, ${alpha * 0.28})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    placed.push({ name: b.name, year: b.year, x, y, r });
  }
  return placed;
}
