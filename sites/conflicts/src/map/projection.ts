import { geoEqualEarth, geoPath, geoGraticule10, type GeoProjection, type GeoPath } from 'd3-geo';
import type { ZoomTransform } from 'd3-zoom';

/**
 * Equal Earth: an equal-area projection, so a conflict bubble covering Central
 * Africa is not visually inflated the way it would be on Mercator. For a map whose
 * entire subject is *how big things were*, an area-distorting projection would
 * undermine the data.
 */
export function createProjection(width: number, height: number): GeoProjection {
  return geoEqualEarth().fitExtent(
    [
      [12, 12],
      [width - 12, height - 12],
    ],
    { type: 'Sphere' },
  );
}

export function createPath(projection: GeoProjection, ctx: CanvasRenderingContext2D): GeoPath {
  return geoPath(projection, ctx);
}

export const GRATICULE = geoGraticule10();

/** Screen pixel → unzoomed map space, for hit-testing against projected points. */
export function screenToMap(t: ZoomTransform, sx: number, sy: number): [number, number] {
  return [(sx - t.x) / t.k, (sy - t.y) / t.k];
}
