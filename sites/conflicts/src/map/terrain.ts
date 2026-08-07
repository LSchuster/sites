import { geoEqualEarth, geoPath } from 'd3-geo';
import { dataUrl, loadJson } from '../data/assets.ts';

/**
 * The pre-projected shaded-relief plate (see pipeline/8-terrain.ts).
 *
 * A progressive enhancement: fetched lazily after the borders are up, decoded
 * off the first-paint path, and the map is complete without it. The plate was
 * baked in a reference Equal Earth frame; because the live projection is also
 * Equal Earth and differs only in scale and translate, mapping the plate onto
 * the screen is a pure affine transform — the renderer embosses it into the
 * land fills with a single source-atop drawImage.
 */

interface TerrainIndex {
  file: string;
  width: number;
  height: number;
}

export interface Relief {
  bitmap: ImageBitmap;
  /** Scale of the reference projection the plate was baked with. */
  scale: number;
  /** Translate of that reference projection, in plate pixels. */
  translate: [number, number];
}

let relief: Relief | null = null;
let started = false;

export function getRelief(): Relief | null {
  return relief;
}

/** Kick off the lazy fetch+decode. Safe to call more than once. */
export function ensureRelief(): void {
  if (started) return;
  started = true;
  void (async () => {
    try {
      const index = await loadJson<TerrainIndex>('terrain/index.json');
      const res = await fetch(dataUrl(`terrain/${index.file}`));
      if (!res.ok) return;
      const bitmap = await createImageBitmap(await res.blob());

      // Rebuild the exact reference frame the pipeline used: sphere fitted to
      // the plate width, then shifted so the sphere's top touches row 0.
      const SPHERE = { type: 'Sphere' } as const;
      const ref = geoEqualEarth().fitWidth(index.width, SPHERE);
      const [[, y0]] = geoPath(ref).bounds(SPHERE);
      const t = ref.translate();
      relief = {
        bitmap,
        scale: ref.scale(),
        translate: [t[0], t[1] - y0],
      };
    } catch {
      // Terrain is decorative; a failed fetch must never break the map.
    }
  })();
}
