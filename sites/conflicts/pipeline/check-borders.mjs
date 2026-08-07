import { feature } from 'topojson-client';
import { geoEqualEarth, geoPath } from 'd3-geo';
import fs from 'node:fs';

const topo = JSON.parse(fs.readFileSync('public/data/borders/world_1914.topo.json', 'utf8'));
const fc = feature(topo, topo.objects.world);

console.log('features:', fc.features.length);
const named = fc.features.filter((f) => f.properties?.n);
console.log('named polities:', named.length);
console.log('sample names:', named.slice(0, 6).map((f) => f.properties.n).join(' · '));

// Property keys must be the abbreviated ones the loader expands.
const keys = new Set();
fc.features.forEach((f) => Object.keys(f.properties || {}).forEach((k) => keys.add(k)));
console.log('property keys present:', [...keys].join(','));

const W = 1200, H = 700;
const proj = geoEqualEarth().fitExtent([[12, 12], [W - 12, H - 12]], { type: 'Sphere' });
const path = geoPath(proj);

const places = {
  London: [-0.13, 51.5],
  Tokyo: [139.7, 35.7],
  'Cape Town': [18.4, -33.9],
  'Rio de Janeiro': [-43.2, -22.9],
  'Null Island': [0, 0],
};
console.log('\nprojected (must all be inside 0..%d x 0..%d):', W, H);
let ok = true;
for (const [name, ll] of Object.entries(places)) {
  const p = proj(ll);
  const inside = p && p[0] >= 0 && p[0] <= W && p[1] >= 0 && p[1] <= H;
  if (!inside) ok = false;
  console.log(`  ${name.padEnd(15)} → ${p ? `${p[0].toFixed(0)}, ${p[1].toFixed(0)}` : 'null'} ${inside ? '' : '  ✗ OUT OF BOUNDS'}`);
}

// Sanity of relative geography: Tokyo east of London, Cape Town south of London.
const [lx, ly] = proj(places.London);
const [tx] = proj(places.Tokyo);
const [, cy] = proj(places['Cape Town']);
console.log('\nrelative geography:');
console.log('  Tokyo east of London  :', tx > lx ? 'ok' : 'FAIL');
console.log('  Cape Town south of London:', cy > ly ? 'ok' : 'FAIL');

const b = path.bounds(fc);
console.log('\nland bounds on canvas:', b.map((p) => p.map((v) => v.toFixed(0)).join(',')).join('  →  '));
const area = path.area(fc);
console.log('land area (px²):', area.toFixed(0), area > 50000 ? '(plausible)' : '(TOO SMALL — geometry broken)');
process.exit(ok && area > 50000 ? 0 : 1);
