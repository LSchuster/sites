// Build-time generator for the globe's landmass data. Reads Natural Earth
// (public domain) TopoJSON from the `world-atlas` devDependency and emits two
// small binary artifacts into public/earth/ which ARE COMMITTED — CI never
// runs this script, it only re-runs when the source data or format changes:
//
//   land.bin  — equirectangular land bitmask.
//               uint16 LE width, uint16 LE height, then row-major bits
//               (MSB first), row 0 = lat +90, col 0 = lon −180.
//   coast.bin — coastline polylines for the glowing outlines.
//               uint32 LE polyline count, then per polyline:
//               uint16 LE point count, then per point int16 LE lat*120,
//               int16 LE lon*120.
//
// Run with `npm run earth` from the site folder.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as topojson from 'topojson-client';

const require = createRequire(import.meta.url);
const outDir = fileURLToPath(new URL('../public/earth/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const MASK_W = 1440; // 0.25° — enough for a ~0.5° dot grid to hug the coasts
const MASK_H = 720;

function loadLand(resolution) {
  const topo = JSON.parse(readFileSync(require.resolve(`world-atlas/land-${resolution}.json`), 'utf8'));
  const fc = topojson.feature(topo, topo.objects.land);
  const rings = [];
  for (const feature of fc.features ?? [fc]) {
    const g = feature.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) rings.push(ring);
  }
  return rings; // array of [[lon, lat], ...] closed rings (holes included — even-odd)
}

// ---- land.bin: even-odd scanline rasterization of the 50m rings ----------

const rings50 = loadLand('50m');
const mask = new Uint8Array((MASK_W * MASK_H) / 8);

for (let y = 0; y < MASK_H; y++) {
  const lat = 90 - ((y + 0.5) * 180) / MASK_H;
  const crossings = [];
  for (const ring of rings50) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      // half-open rule so shared vertices are counted exactly once
      if (y1 <= lat === y2 <= lat) continue;
      crossings.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  crossings.sort((a, b) => a - b);
  for (let k = 0; k + 1 < crossings.length; k += 2) {
    const x0 = Math.max(0, Math.ceil(((crossings[k] + 180) / 360) * MASK_W - 0.5));
    const x1 = Math.min(MASK_W - 1, Math.floor(((crossings[k + 1] + 180) / 360) * MASK_W - 0.5));
    for (let x = x0; x <= x1; x++) {
      const bit = y * MASK_W + x;
      mask[bit >> 3] |= 0x80 >> (bit & 7);
    }
  }
}

const landBuf = Buffer.alloc(4 + mask.length);
landBuf.writeUInt16LE(MASK_W, 0);
landBuf.writeUInt16LE(MASK_H, 2);
Buffer.from(mask).copy(landBuf, 4);
writeFileSync(outDir + 'land.bin', landBuf);

// ---- coast.bin: 110m rings as polylines ----------------------------------

const rings110 = loadLand('110m');
const chunks = [];
const head = Buffer.alloc(4);
head.writeUInt32LE(rings110.length, 0);
chunks.push(head);
let points = 0;
for (const ring of rings110) {
  const n = Math.min(ring.length, 0xffff);
  const buf = Buffer.alloc(2 + n * 4);
  buf.writeUInt16LE(n, 0);
  for (let i = 0; i < n; i++) {
    const [lon, lat] = ring[i];
    buf.writeInt16LE(Math.round(lat * 120), 2 + i * 4);
    buf.writeInt16LE(Math.round(lon * 120), 2 + i * 4 + 2);
  }
  points += n;
  chunks.push(buf);
}
writeFileSync(outDir + 'coast.bin', Buffer.concat(chunks));

let landBits = 0;
for (const b of mask) {
  let v = b;
  while (v) {
    landBits += v & 1;
    v >>= 1;
  }
}
console.log(
  `land.bin  ${landBuf.length} B  (${MASK_W}×${MASK_H}, ${((100 * landBits) / (MASK_W * MASK_H)).toFixed(1)}% land)`,
);
console.log(`coast.bin ${chunks.reduce((s, c) => s + c.length, 0)} B  (${rings110.length} rings, ${points} points)`);
