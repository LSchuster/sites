/**
 * The paper-grain tile: warm fibre flecks with sparse darker pores, at whisper
 * alpha. Rendered once to a data URL and tiled by CSS on a DOM element above
 * the canvases — grain belongs to the page, not the map, so it must not pan,
 * and as a browser-composited background it costs the render loop nothing.
 * (A canvas pattern fill of the same tile cost ~5 fps of playback.)
 */
export function grainTileUrl(): string {
  const size = 160;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random();
    if (v < 0.06) {
      d[i] = 8;
      d[i + 1] = 10;
      d[i + 2] = 14;
      d[i + 3] = Math.random() * 12;
    } else {
      d[i] = 232;
      d[i + 1] = 224;
      d[i + 2] = 206;
      d[i + 3] = Math.random() * 7;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
