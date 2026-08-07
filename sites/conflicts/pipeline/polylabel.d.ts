declare module 'polylabel' {
  /**
   * Pole of inaccessibility of a planar polygon (outer ring + holes).
   * Returns [x, y] with a `distance` property.
   */
  export default function polylabel(
    rings: number[][][],
    precision?: number,
  ): [number, number] & { distance: number };
}
