/**
 * Shaded-relief terrain plate, pre-projected to Equal Earth.
 *
 * Source: Natural Earth "GRAY_50M_SR" grayscale shaded relief.
 * Natural Earth raster + vector map data is in the PUBLIC DOMAIN
 * (https://www.naturalearthdata.com/about/terms-of-use/), so shipping a
 * derived plate alongside the GPL-3.0 border data carries no obligation.
 *
 * Output: public/data/terrain/relief.webp — not a grayscale image but a
 * "plate shading" alpha mask: pixels darker than the land median become
 * translucent black, lighter ones translucent white, flat terrain fully
 * transparent. At runtime one source-atop drawImage embosses this into the
 * land fills, darkening and lightening the territory tints without
 * desaturating them — an engraved look rather than a photo overlay.
 *
 * Pre-projecting matters: d3-geo cannot warp rasters at runtime. Because the
 * live projection is also Equal Earth and fitExtent only ever changes scale
 * and translate, the runtime mapping from this plate to the screen is a pure
 * affine transform — one drawImage, no per-pixel work.
 *
 * Run: npm run data:terrain
 */
import { geoEqualEarth } from 'd3-geo';
import { unzipSync } from 'fflate';
// @ts-expect-error geotiff ships types but its ESM/CJS interop confuses tsx's resolver
import { fromArrayBuffer } from 'geotiff';
import sharp from 'sharp';
import { cachedFetch, kb, writeOut } from './lib.ts';

const SOURCE_URL = 'https://naciscdn.org/naturalearth/50m/raster/GRAY_50M_SR.zip';
const SPHERE = { type: 'Sphere' } as const;

/** Output plate width; height follows from the Equal Earth aspect ratio. */
const WIDTH = 2600;

/** Alpha per unit of gray deviation from the land median. */
const GAIN = 2.0;
/** Alpha ceiling — full black/white pixels would read as photo, not engraving. */
const MAX_ALPHA = 170;

async function main(): Promise<void> {
  console.log('fetching Natural Earth GRAY_50M_SR (public domain)…');
  const zip = await cachedFetch(SOURCE_URL, 'GRAY_50M_SR.zip');
  const files = unzipSync(new Uint8Array(zip));
  const tifName = Object.keys(files).find((n) => n.toLowerCase().endsWith('.tif'));
  if (!tifName) throw new Error('no .tif in GRAY_50M_SR.zip');
  const tifBytes = files[tifName];
  if (!tifBytes) throw new Error('unzip produced no bytes');

  const tiff = await fromArrayBuffer(
    tifBytes.buffer.slice(tifBytes.byteOffset, tifBytes.byteOffset + tifBytes.byteLength),
  );
  const image = await tiff.getImage();
  const sw: number = image.getWidth();
  const sh: number = image.getHeight();
  const rasters = await image.readRasters();
  const gray = rasters[0] as Uint8Array;
  console.log(`source ${sw}×${sh}`);

  // The ocean is a single flat gray — by far the modal value. Find it so ocean
  // can be fully transparent, and take the median of everything else as the
  // land's neutral tone.
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i] ?? 0] = (hist[gray[i] ?? 0] ?? 0) + 1;
  let ocean = 0;
  for (let v = 0; v < 256; v++) if ((hist[v] ?? 0) > (hist[ocean] ?? 0)) ocean = v;
  const landTotal = gray.length - (hist[ocean] ?? 0);
  let acc = 0;
  let median = 128;
  for (let v = 0; v < 256; v++) {
    if (v === ocean) continue;
    acc += hist[v] ?? 0;
    if (acc >= landTotal / 2) {
      median = v;
      break;
    }
  }
  console.log(`ocean gray ${ocean}, land median ${median}`);

  // Reference Equal Earth frame. fitWidth pins the sphere to the plate width;
  // the runtime rebuilds this exact projection from index.json to derive the
  // affine transform onto the live projection.
  const ref = geoEqualEarth().fitWidth(WIDTH, SPHERE);
  const refPath = (await import('d3-geo')).geoPath(ref);
  const [[, y0], [, y1]] = refPath.bounds(SPHERE);
  const height = Math.ceil(y1 - y0);
  // Shift the sphere to the top of the plate so no rows are wasted.
  const t = ref.translate();
  ref.translate([t[0], t[1] - y0]);

  const rgba = new Uint8ClampedArray(WIDTH * height * 4);
  let landPx = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const inv = ref.invert?.([x + 0.5, y + 0.5]);
      if (!inv || !Number.isFinite(inv[0]) || !Number.isFinite(inv[1])) continue;
      const [lon, lat] = inv;
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) continue;
      // Equal Earth's invert answers for points outside the sphere too;
      // round-tripping rejects them.
      const fwd = ref([lon, lat]);
      if (!fwd || Math.abs(fwd[0] - x - 0.5) > 0.5 || Math.abs(fwd[1] - y - 0.5) > 0.5) continue;

      // Bilinear sample of the equirectangular source.
      const sx = ((lon + 180) / 360) * (sw - 1);
      const sy = ((90 - lat) / 180) * (sh - 1);
      const x0 = Math.floor(sx);
      const y0s = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0s;
      const x1s = Math.min(sw - 1, x0 + 1);
      const y1s = Math.min(sh - 1, y0s + 1);
      const v00 = gray[y0s * sw + x0] ?? ocean;
      const v10 = gray[y0s * sw + x1s] ?? ocean;
      const v01 = gray[y1s * sw + x0] ?? ocean;
      const v11 = gray[y1s * sw + x1s] ?? ocean;
      const v =
        v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;

      // Ocean stays fully transparent (the runtime clips to land anyway, but
      // transparency here compresses far better and avoids veiling lakes).
      if (Math.abs(v - ocean) < 1.5) continue;

      // Engraving is mostly shadow: highlights get less than half the gain and
      // a hard cap, or the ice sheets and high plateaus turn chalk-white and
      // the plate reads as a photo instead of linework.
      const d = v - median;
      const gain = d > 0 ? GAIN * 0.4 : GAIN;
      const cap = d > 0 ? 95 : MAX_ALPHA;
      const alpha = Math.min(cap, Math.abs(d) * gain);
      if (alpha < 3) continue;
      const i = (y * WIDTH + x) * 4;
      const light = d > 0;
      rgba[i] = light ? 255 : 0;
      rgba[i + 1] = light ? 250 : 0;
      rgba[i + 2] = light ? 240 : 0;
      rgba[i + 3] = alpha;
      landPx++;
    }
  }
  console.log(`plate ${WIDTH}×${height}, ${((landPx / (WIDTH * height)) * 100).toFixed(1)}% shaded`);

  const webp = await sharp(Buffer.from(rgba.buffer), {
    raw: { width: WIDTH, height, channels: 4 },
  })
    .webp({ quality: 60, alphaQuality: 58, effort: 6 })
    .toBuffer();

  const bytes = await writeOut('terrain/relief.webp', webp);
  await writeOut(
    'terrain/index.json',
    JSON.stringify({ file: 'relief.webp', width: WIDTH, height }),
  );
  console.log(`terrain/relief.webp  ${kb(bytes)}`);
}

void main();
