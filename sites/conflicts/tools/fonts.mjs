/**
 * One-off font build: EB Garamond (OFL 1.1) → subset WOFF2 instances.
 *
 * Downloads the variable font from the google/fonts repo (cached in
 * data/cache/), pins the weight axis at 500 and 600, subsets to the Latin
 * repertoire the atlas actually uses, and writes WOFF2 files into
 * src/assets/fonts/ where styles.css @font-face picks them up.
 *
 * Not part of `data:all` — fonts change never; run manually if the subset
 * needs to grow:  node tools/fonts.mjs
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, 'data', 'cache');
const OUT = join(root, 'src', 'assets', 'fonts');

const FONT_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf';
const OFL_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/OFL.txt';

/**
 * Character repertoire: printable ASCII, Latin-1, the Latin Extended
 * characters that actually occur in the shipped datasets (polity names,
 * conflict names, German translations), and the typographic marks the UI
 * uses. Scripts the face does not cover (Cherokee, syllabics in a few battle
 * names) fall back to system fonts regardless, so they are not subset in.
 */
function repertoire() {
  const chars = [];
  const add = (from, to) => {
    for (let c = from; c <= to; c++) chars.push(String.fromCodePoint(c));
  };
  add(0x20, 0x7e); // printable ASCII
  add(0xa0, 0xff); // Latin-1 supplement
  chars.push(
    ...'ĆćČčĐēėęěğĩīıľŁłńŋōŏőœřŚśŞşŠšťũūůųźŻżŽžșț',
    ...'ơưứừửữựớờởỡợấầẩẫậắằẳẵặếềểễệốồổỗộủụịỉḍḥṈạ',
    ...'–—‘’“”•·×…',
  );
  return chars.join('');
}

async function fetchCached(url, file) {
  const path = join(CACHE, file);
  try {
    await access(path);
    return readFile(path);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(CACHE, { recursive: true });
    await writeFile(path, buf);
    return buf;
  }
}

const source = await fetchCached(FONT_URL, 'EBGaramond[wght].ttf');
const ofl = await fetchCached(OFL_URL, 'EBGaramond-OFL.txt');
await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'OFL.txt'), ofl);

const text = repertoire();
for (const weight of [500, 600]) {
  const woff2 = await subsetFont(source, text, {
    targetFormat: 'woff2',
    variationAxes: { wght: weight },
    // Small-caps/ligature/swash glyph variants triple the file (21 → 63 KB).
    // Canvas labels use real letterspaced capitals and DOM small caps
    // synthesize acceptably, so the closure buys nothing worth 40 KB.
    noLayoutClosure: true,
  });
  const name = `EBGaramond-${weight}.woff2`;
  await writeFile(join(OUT, name), woff2);
  console.log(`${name}  ${(woff2.length / 1024).toFixed(1)} KB`);
}
