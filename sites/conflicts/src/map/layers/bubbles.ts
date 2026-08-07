import type { GeoProjection } from 'd3-geo';
import type { ZoomTransform } from 'd3-zoom';
import type { Conflict, VizMode } from '../../types.ts';
import { magnitudeColor, radius } from '../scales.ts';
import { INK } from '../../theme.ts';
import { prefersReducedMotion } from '../../motion.ts';

export interface PlacedMark {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface BubbleOptions {
  conflicts: Conflict[];
  projection: GeoProjection;
  transform: ZoomTransform;
  mode: VizMode;
  max: number;
  /** id → 0..1 entry animation progress. */
  progress: Map<string, number>;
  /** id → 0..1 ignition shockwave progress; present only while the ring runs. */
  ignition: Map<string, number>;
  /** Clock in seconds, for the ember pulse. */
  time: number;
  valueOf: (c: Conflict) => number;
  hoveredId: string | null;
  selectedId: string | null;
  dpr: number;
}

const TAU = Math.PI * 2;

/**
 * Stable per-conflict phase offset in 0..2π, so the active wars breathe out of
 * step with each other — synchronised pulsing reads as a blinking UI, not a map.
 */
function pulsePhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 628) / 100;
}

/** Pixel distance representing `degrees` of latitude at a conflict's location. */
function theatreRadius(
  projection: GeoProjection,
  lon: number,
  lat: number,
  degrees: number,
): number {
  const here = projection([lon, lat]);
  const north = projection([lon, Math.min(89, lat + degrees)]);
  if (!here || !north) return 0;
  return Math.hypot(north[0] - here[0], north[1] - here[1]);
}

/**
 * Draws the conflict marks.
 *
 * Two independent encodings, deliberately kept apart:
 *   - the bubble's radius is the human cost, drawn in SCREEN space so it stays
 *     legible at every zoom level;
 *   - the faint outer ring is the geographic extent of the theatre, drawn in MAP
 *     space so it scales with the terrain the way a real footprint would.
 * A small bubble inside a huge ring is a sprawling, thinly lethal war; the reverse
 * is a massacre in one place.
 */
export function drawBubbles(ctx: CanvasRenderingContext2D, opts: BubbleOptions): PlacedMark[] {
  const {
    conflicts,
    projection,
    transform,
    max,
    progress,
    ignition,
    time,
    valueOf,
    hoveredId,
    selectedId,
    dpr,
  } = opts;
  const reduced = prefersReducedMotion();

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const marks: PlacedMark[] = [];
  const placed: { c: Conflict; x: number; y: number; r: number; t: number; value: number }[] = [];

  for (const c of conflicts) {
    const t = progress.get(c.id) ?? 0;
    if (t <= 0.001) continue;
    const p = projection(c.centroid);
    if (!p) continue;
    const x = p[0] * transform.k + transform.x;
    const y = p[1] * transform.k + transform.y;
    const value = valueOf(c);
    placed.push({ c, x, y, r: radius({ value, max }), t, value });
  }

  // Largest first, so small marks land on top and stay clickable.
  placed.sort((a, b) => b.r - a.r);

  // Pass 1 — theatre extents, behind everything.
  for (const { c, x, y, t } of placed) {
    if (!c.extent) continue;
    const tr = theatreRadius(projection, c.centroid[0], c.centroid[1], c.extent) * transform.k;
    if (tr < 8) continue;
    ctx.beginPath();
    ctx.arc(x, y, tr, 0, TAU);
    ctx.strokeStyle = `rgba(255, 185, 114, ${0.1 * t})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Pass 2 — the marks themselves.
  for (const { c, x, y, r: baseR, t, value } of placed) {
    const isHovered = c.id === hoveredId;
    const isSelected = c.id === selectedId;
    // Ease-out on entry, plus a small lift on hover.
    const eased = 1 - Math.pow(1 - t, 3);
    const r = baseR * eased * (isHovered || isSelected ? 1.12 : 1);
    if (r < 0.5) continue;

    const color = magnitudeColor({ value, max });

    // While the war runs its glow breathes — a slow ember pulse, staggered per
    // conflict, subtle enough to feel like heat rather than a blink.
    const pulse = reduced ? 0 : Math.sin(time * 1.7 + pulsePhase(c.id));
    const ig = ignition.get(c.id);
    // The ignition flash briefly overdrives the glow before the ring detaches.
    const flash = ig !== undefined ? (1 - ig) * 0.3 : 0;
    const glowR = r * 2.3 * (1 + 0.06 * pulse);

    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, glowR);
    glow.addColorStop(0, hexA(color, (0.38 + 0.05 * pulse + flash) * eased));
    glow.addColorStop(0.5, hexA(color, (0.12 + 0.02 * pulse + flash * 0.4) * eased));
    glow.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, TAU);
    ctx.fill();

    // Ignition shockwave: one ring expanding out of the mark when its war
    // begins (or a scrub lands inside it), fading as it travels.
    if (ig !== undefined) {
      const e = 1 - Math.pow(1 - ig, 3);
      ctx.beginPath();
      ctx.arc(x, y, r + (r * 1.6 + 12) * e, 0, TAU);
      ctx.strokeStyle = hexA(color, Math.pow(1 - ig, 1.4) * 0.55 * eased);
      ctx.lineWidth = 0.4 + 1.6 * (1 - ig);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = hexA(color, 0.3 * eased);
    ctx.fill();

    // The ring carries confidence. A disputed figure should not look as solid as
    // a documented one.
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.strokeStyle = hexA(color, (c.total.confidence === 'documented' ? 0.98 : 0.72) * eased);
    ctx.lineWidth = c.total.confidence === 'documented' ? 1.9 : 1.3;
    ctx.setLineDash(c.total.confidence === 'disputed' ? [3.5, 3.5] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, TAU);
      ctx.strokeStyle = isSelected ? INK.primary : 'rgba(242,239,233,0.5)';
      ctx.lineWidth = isSelected ? 1.6 : 1;
      ctx.stroke();
    }

    marks.push({ id: c.id, x, y, r: Math.max(r, 9) });
  }

  return marks;
}

/** Apply alpha to a #rrggbb colour. */
function hexA(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
