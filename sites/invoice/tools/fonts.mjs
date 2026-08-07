// One-off: fetch the Inter variable font (OFL 1.1, google/fonts mirror), pin
// static instances (PDF embedding via fontkit needs non-variable fonts), and
// subset to a broad Latin repertoire. Output is committed to src/assets/fonts/.
//
//   node tools/fonts.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import subsetFont from 'subset-font';

const SRC_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf';
const CACHE = new URL('./cache/', import.meta.url);
const OUT = new URL('../src/assets/fonts/', import.meta.url);

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });

const cached = new URL('inter-variable.ttf', CACHE);
if (!existsSync(cached)) {
  console.log('downloading Inter variable font …');
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  await writeFile(cached, Buffer.from(await res.arrayBuffer()));
}
const variable = await readFile(cached);

// Printable ASCII, Latin-1 Supplement, Latin Extended-A, plus typographic
// punctuation and symbols that appear on invoices.
let text = '';
for (const [from, to] of [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x100, 0x17f],
]) {
  for (let cp = from; cp <= to; cp++) text += String.fromCodePoint(cp);
}
text += '€‚„“”‘’‹›–—…•§°²³µ†‡‰™';

// Neutralize GSUB by renaming its table-directory tag. Inter's calt/case
// features substitute alternates for -, +, ( … next to digits/capitals, but
// pdf-lib only writes /W widths for cmap-reachable glyphs — substituted
// glyphs fall back to the 1000-unit default width and render with a bogus
// gap. Without GSUB, layout uses cmap glyphs whose widths are correct.
// GPOS (kerning) is kept.
function neutralizeGsub(bytes) {
  const numTables = (bytes[4] << 8) | bytes[5];
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    const tag = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    if (tag === 'GSUB') bytes[off] = 'X'.charCodeAt(0); // GSUB → XSUB
  }
  return bytes;
}

for (const [wght, file] of [
  [400, 'Inter-Regular.ttf'],
  [600, 'Inter-SemiBold.ttf'],
]) {
  const bytes = neutralizeGsub(
    await subsetFont(variable, text, {
      targetFormat: 'truetype',
      variationAxes: { wght, opsz: 14 },
    }),
  );
  await writeFile(new URL(file, OUT), bytes);
  console.log(`${file}: ${(bytes.length / 1024).toFixed(1)} kB`);
}
console.log('done — remember src/assets/fonts/OFL.txt must accompany the fonts.');
