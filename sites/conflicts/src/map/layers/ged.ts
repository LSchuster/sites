import type { GeoProjection } from 'd3-geo';
import type { ZoomTransform } from 'd3-zoom';
import type { GedCell } from '../../data/ged.ts';

const TAU = Math.PI * 2;

/**
 * The modern high-resolution layer: every lethal event UCDP recorded since 1989,
 * binned to a quarter-degree grid.
 *
 * Drawn as a dim intensity field rather than discrete marks, and kept beneath the
 * curated conflict bubbles. The density jump at 1989 is enormous — nothing before
 * it comes close — and that is a fact about record-keeping, not about violence.
 * The timeline annotates the boundary so the change reads as "the data changes
 * here" rather than "the world changed here".
 */
export function drawGed(
  ctx: CanvasRenderingContext2D,
  opts: {
    cells: GedCell[];
    projection: GeoProjection;
    transform: ZoomTransform;
    dpr: number;
    opacity: number;
  },
): void {
  const { cells, projection, transform, dpr, opacity } = opts;
  if (!cells.length || opacity <= 0.01) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'lighter';

  for (const c of cells) {
    const p = projection([c.lon, c.lat]);
    if (!p) continue;
    const x = p[0] * transform.k + transform.x;
    const y = p[1] * transform.k + transform.y;

    // Damped like the bubbles, on a much smaller range: this is a field, not a mark.
    const mag = Math.min(1, Math.pow(c.deaths / 4000, 0.4));
    const r = (2.5 + mag * 9) * Math.min(2.2, Math.max(1, transform.k * 0.45));
    const a = (0.1 + mag * 0.4) * opacity;

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 150, 70, ${a})`);
    g.addColorStop(1, 'rgba(255, 150, 70, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}
