import type { GeoProjection } from 'd3-geo';
import type { ZoomTransform } from 'd3-zoom';
import { FONT, INK, MAP } from '../../theme.ts';
import type { BorderSnapshot } from '../../data/borders.ts';

/**
 * Polity labels: serif letterspaced capitals with an ink halo — the atlas
 * convention — drawn on the overlay as pre-baked sprites.
 *
 * Three design decisions:
 *
 * 1. **Sprites, not per-frame text.** Halo + letterspacing means two canvas
 *    text passes per character; baked once per (text, size, style) into a
 *    small offscreen canvas, a label costs one drawImage per frame afterwards.
 *
 * 2. **Placement is computed only when the view settles or the snapshot pair
 *    changes**, then re-positioned per frame with the same affine the layer
 *    blits use. Greedy rejection by screen-space boxes, biggest polities
 *    first, keeps the plate uncluttered at every zoom.
 *
 * 3. **Labels fade per entity, independently of the ground crossfade.** A
 *    label only in the earlier snapshot dims with (1−mix), one only in the
 *    later brightens with mix, and one present in both stays put — its anchor
 *    gliding between the two snapshots' poles of inaccessibility — while
 *    every appearance/disappearance additionally eases through a short
 *    per-label fade, both directions scrub-safe.
 */

/** Label sizing: on-screen px for a polity of `area` at zoom `k`. */
function fontSize(area: number, k: number): number {
  // Area is in millionths of a steradian (France ≈ 13k, Russia ≈ 400k).
  const s = 8.5 + 2.6 * Math.log2(1 + (area * k * k) / 30000);
  return Math.min(24, Math.round(s));
}

/** Smallest polity area worth a label at zoom `k`. */
function minArea(k: number): number {
  return 9000 / Math.pow(k, 2.5);
}

/** Seconds for a label to fade fully in or out. */
const LABEL_FADE = 0.35;

/** Hard cap on labels per frame — a plate, not a phone book. */
const MAX_LABELS = 64;

interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

const sprites = new Map<string, Sprite>();

function bakeSprite(text: string, size: number, sub: boolean, dpr: number): Sprite {
  const key = `${text}|${size}|${sub ? 1 : 0}|${dpr}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  // The cache only ever holds labels for two snapshots at a handful of sizes;
  // clear wholesale if it somehow balloons.
  if (sprites.size > 400) sprites.clear();

  const display = text.toUpperCase();
  const tracking = size * (0.13 + 0.08 * Math.min(1, size / 22));
  const font = `${sub ? 500 : 600} ${size * dpr}px ${FONT.display}`;

  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.font = font;
  let width = 0;
  for (const ch of display) width += ctx.measureText(ch).width + tracking * dpr;
  width = Math.max(1, width - tracking * dpr);

  const pad = Math.ceil(3 * dpr);
  c.width = Math.ceil(width) + pad * 2;
  c.height = Math.ceil(size * 1.4 * dpr) + pad * 2;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = MAP.labelHalo;
  ctx.lineWidth = Math.max(2, size / 6) * dpr;
  ctx.fillStyle = sub ? INK.secondary : INK.primary;

  const y = c.height / 2;
  let x = pad;
  for (const ch of display) {
    ctx.strokeText(ch, x, y);
    x += ctx.measureText(ch).width + tracking * dpr;
  }
  x = pad;
  for (const ch of display) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking * dpr;
  }

  const sprite = { canvas: c, w: c.width, h: c.height };
  sprites.set(key, sprite);
  return sprite;
}

interface Placed {
  key: string;
  text: string;
  sub: boolean;
  /** Projected map coords (unzoomed) in the A snapshot… */
  ax: number;
  ay: number;
  /** …and in B, for the glide. Equal to ax/ay when not present in both. */
  bx: number;
  by: number;
  set: 'a' | 'b' | 'both';
  sprite: Sprite;
  priority: number;
}

interface Candidate {
  key: string;
  text: string;
  sub: boolean;
  entity: number | null;
  area: number;
  anchor: [number, number];
}

function candidatesOf(snapshot: BorderSnapshot, k: number): Map<string, Candidate> {
  const floor = minArea(k);
  const out = new Map<string, Candidate>();
  for (const f of snapshot.fc.features) {
    const p = f.properties;
    if (!p?.name || !p.labelAt || p.area < floor) continue;
    const key = `${p.entity ?? 'x'}|${p.name}`;
    const prior = out.get(key);
    // Duplicate names (split territories): keep the largest part's anchor.
    if (prior && prior.area >= p.area) continue;
    out.set(key, {
      key,
      text: p.name,
      sub: p.subjectTo != null,
      entity: p.entity,
      area: p.area,
      anchor: p.labelAt,
    });
  }
  return out;
}

export class LabelLayer {
  private placed: Placed[] = [];
  private placementKey = '';
  /** key → 0..1 fade, advanced every frame; retiring labels fade to removal. */
  private progress = new Map<string, number>();
  private retiring = new Map<string, Placed>();
  private fontsReady = false;

  constructor() {
    void document.fonts.load(`600 16px "EB Garamond"`).then(() => {
      this.fontsReady = true;
    });
  }

  /**
   * Recompute placement. Cheap enough for every snapshot-pair change (a few
   * hundred projections + a greedy sweep), but callers should gate on
   * settle/pair-change, not call it per frame.
   */
  place(
    a: BorderSnapshot | null,
    b: BorderSnapshot | null,
    yearA: number,
    yearB: number,
    projection: GeoProjection,
    t: ZoomTransform,
    dpr: number,
  ): void {
    // Snapshot presence is part of the key: after a year jump this runs before
    // the new snapshot has arrived, and its arrival must not be masked by a
    // stale placement.
    const key =
      `${yearA}|${yearB}|${a ? 1 : 0}${b ? 1 : 0}|${this.fontsReady ? 1 : 0}|` +
      `${t.k.toFixed(3)}|${t.x.toFixed(0)}|${t.y.toFixed(0)}`;
    if (key === this.placementKey) return;
    this.placementKey = key;

    const prevPlaced = this.placed;
    this.placed = [];
    if (!this.fontsReady || !a) {
      for (const p of prevPlaced) this.retiring.set(p.key, p);
      return;
    }

    const candA = candidatesOf(a, t.k);
    const candB = b && b !== a ? candidatesOf(b, t.k) : candA;

    // Union of both snapshots' candidates, classified by which side has them.
    const union = new Map<
      string,
      { cand: Candidate; set: 'a' | 'b' | 'both'; anchorB: [number, number] | null }
    >();
    for (const [ckey, cand] of candA) {
      const inB = candB.get(ckey);
      union.set(ckey, {
        cand,
        set: inB ? 'both' : 'a',
        anchorB: inB ? inB.anchor : null,
      });
    }
    if (candB !== candA) {
      for (const [ckey, cand] of candB) {
        if (!union.has(ckey)) union.set(ckey, { cand, set: 'b', anchorB: null });
      }
    }

    const ordered = [...union.values()].sort((x, y) => y.cand.area - x.cand.area);

    // Greedy screen-space AABB rejection, biggest polities first.
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const collides = (x0: number, y0: number, x1: number, y1: number) =>
      boxes.some((r) => x0 < r.x1 && x1 > r.x0 && y0 < r.y1 && y1 > r.y0);

    for (const { cand, set, anchorB } of ordered) {
      if (this.placed.length >= MAX_LABELS) break;
      const pa = projection(cand.anchor);
      if (!pa) continue;
      const pb = anchorB ? (projection(anchorB) ?? pa) : pa;
      const size = fontSize(cand.area, t.k) * (cand.sub ? 0.8 : 1);
      if (size < 8) continue;
      const sprite = bakeSprite(cand.text, size, cand.sub, dpr);

      const sx = (pa[0] * t.k + t.x) * dpr;
      const sy = (pa[1] * t.k + t.y) * dpr;
      const x0 = sx - sprite.w / 2 - 2;
      const y0 = sy - sprite.h / 2 - 2;
      const x1 = sx + sprite.w / 2 + 2;
      const y1 = sy + sprite.h / 2 + 2;
      if (collides(x0, y0, x1, y1)) continue;
      boxes.push({ x0, y0, x1, y1 });

      this.placed.push({
        key: cand.key,
        text: cand.text,
        sub: cand.sub,
        ax: pa[0],
        ay: pa[1],
        bx: pb[0],
        by: pb[1],
        set,
        sprite,
        priority: cand.area,
      });
    }

    // Labels that lost their spot fade out from where they were.
    const alive = new Set(this.placed.map((p) => p.key));
    for (const p of prevPlaced) {
      if (!alive.has(p.key)) this.retiring.set(p.key, p);
    }
    for (const key2 of this.retiring.keys()) {
      if (alive.has(key2)) this.retiring.delete(key2);
    }
  }

  /**
   * Draw one frame. `mix` is the ground crossfade; `dt` advances the
   * per-label fades (pass 0 under reduced motion for hard cuts).
   */
  draw(ctx: CanvasRenderingContext2D, t: ZoomTransform, dpr: number, mix: number, dt: number): void {
    if (!this.placed.length && !this.retiring.size) return;
    const step = dt > 0 ? dt / LABEL_FADE : 1;
    const eased = mix * mix * (3 - 2 * mix);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const drawOne = (p: Placed, fade: number) => {
      let alpha = fade;
      if (p.set === 'a') alpha *= 1 - eased;
      else if (p.set === 'b') alpha *= eased;
      if (alpha <= 0.01) return;
      const mx = p.ax + (p.bx - p.ax) * eased;
      const my = p.ay + (p.by - p.ay) * eased;
      const sx = (mx * t.k + t.x) * dpr;
      const sy = (my * t.k + t.y) * dpr;
      ctx.globalAlpha = alpha * (p.sub ? 0.82 : 0.92);
      ctx.drawImage(p.sprite.canvas, Math.round(sx - p.sprite.w / 2), Math.round(sy - p.sprite.h / 2));
    };

    for (const p of this.placed) {
      const cur = this.progress.get(p.key) ?? 0;
      const next = Math.min(1, cur + step);
      this.progress.set(p.key, next);
      // Ease-out cubic on the entry.
      drawOne(p, 1 - Math.pow(1 - next, 3));
    }
    for (const [key, p] of this.retiring) {
      const cur = this.progress.get(key) ?? 0;
      const next = cur - step;
      if (next <= 0) {
        this.retiring.delete(key);
        this.progress.delete(key);
        continue;
      }
      this.progress.set(key, next);
      drawOne(p, 1 - Math.pow(1 - next, 3));
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
