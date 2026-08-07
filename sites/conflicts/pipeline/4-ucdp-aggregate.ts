/**
 * UCDP GED pipeline — modern high-resolution conflict data, 1989–2024.
 *
 * The raw file is ~239 MB of CSV covering roughly 350,000 individual lethal events.
 * Shipping that to a browser is out of the question, so this aggregates events into
 * 0.25° grid cells per year and writes decade-sharded binary. The result is a
 * couple of megabytes that the site loads only once the timeline reaches 1989.
 *
 * Source: https://ucdp.uu.se/downloads/  (UCDP GED 25.1, CC BY-4.0)
 *
 * Run: npm run data:ucdp
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { RAW, writeOut, kb } from './lib.ts';

const CSV = resolve(RAW, 'ucdp/extracted/GEDEvent_v25_1.csv');

/** Grid resolution in degrees. Fine enough to see a front line, coarse enough to ship. */
const CELL = 0.25;

/**
 * Streaming CSV parser.
 *
 * Line-splitting does not work on this file: `source_headline` and
 * `source_original` are free text containing both commas and literal newlines
 * inside quoted fields. This walks characters and tracks quote state, which is the
 * only correct way to read it.
 */
async function* parseCsv(path: string): AsyncGenerator<string[]> {
  const stream = createReadStream(path, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quoteJustClosed = false;

  for await (const chunk of stream) {
    for (let i = 0; i < (chunk as string).length; i++) {
      const ch = (chunk as string)[i]!;

      if (inQuotes) {
        if (ch === '"') {
          if (quoteJustClosed) {
            field += '"'; // escaped "" inside a quoted field
            quoteJustClosed = false;
          } else {
            quoteJustClosed = true;
          }
        } else if (quoteJustClosed) {
          inQuotes = false;
          quoteJustClosed = false;
          i--; // reprocess this char outside quotes
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        yield row;
        row = [];
      } else if (ch !== '\r') {
        field += ch;
      }
    }
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

interface Cell {
  deaths: number;
  civilians: number;
}

async function main(): Promise<void> {
  try {
    await stat(CSV);
  } catch {
    console.error(
      `Missing ${CSV}\n` +
        'Download https://ucdp.uu.se/downloads/ged/ged251-csv.zip into data/raw/ucdp/ and extract it.',
    );
    process.exit(1);
  }

  // year → cellKey → totals
  const years = new Map<number, Map<number, Cell>>();
  let rows = 0;
  let events = 0;
  let dropped = 0;
  let header: string[] | null = null;
  let idx = { year: -1, lat: -1, lon: -1, best: -1, civ: -1 };

  for await (const row of parseCsv(CSV)) {
    if (!header) {
      header = row;
      idx = {
        year: header.indexOf('year'),
        lat: header.indexOf('latitude'),
        lon: header.indexOf('longitude'),
        best: header.indexOf('best'),
        civ: header.indexOf('deaths_civilians'),
      };
      if (Object.values(idx).some((v) => v < 0)) throw new Error('unexpected GED columns');
      continue;
    }
    rows++;

    const year = Number(row[idx.year]);
    const lat = Number(row[idx.lat]);
    const lon = Number(row[idx.lon]);
    const best = Number(row[idx.best]);
    const civ = Number(row[idx.civ]);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      dropped++;
      continue;
    }
    events++;

    const lonIdx = Math.round(lon / CELL);
    const latIdx = Math.round(lat / CELL);
    const key = (lonIdx + 720) * 1000 + (latIdx + 360);

    let cells = years.get(year);
    if (!cells) {
      cells = new Map();
      years.set(year, cells);
    }
    const cell = cells.get(key);
    const deaths = Number.isFinite(best) ? best : 0;
    const civilians = Number.isFinite(civ) ? civ : 0;
    if (cell) {
      cell.deaths += deaths;
      cell.civilians += civilians;
    } else {
      cells.set(key, { deaths, civilians });
    }
  }

  // Shard by decade. Each record is 4 × Int32: year, lonIdx, latIdx, deaths.
  const decades = new Map<number, number[]>();
  let totalCells = 0;
  let totalDeaths = 0;

  for (const [year, cells] of [...years.entries()].sort((a, b) => a[0] - b[0])) {
    const decade = Math.floor(year / 10) * 10;
    let bucket = decades.get(decade);
    if (!bucket) {
      bucket = [];
      decades.set(decade, bucket);
    }
    for (const [key, cell] of cells) {
      const lonIdx = Math.floor(key / 1000) - 720;
      const latIdx = (key % 1000) - 360;
      bucket.push(year, lonIdx, latIdx, Math.round(cell.deaths));
      totalCells++;
      totalDeaths += cell.deaths;
    }
  }

  const index: { decade: number; cells: number; bytes: number }[] = [];
  let totalBytes = 0;
  let totalGz = 0;

  for (const [decade, values] of [...decades.entries()].sort((a, b) => a[0] - b[0])) {
    const arr = Int32Array.from(values);
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const bytes = await writeOut(`ged/${decade}.bin`, buf);
    const gz = gzipSync(buf).length;
    totalBytes += bytes;
    totalGz += gz;
    index.push({ decade, cells: values.length / 4, bytes });
    console.log(
      `  ${decade}s  ${String(values.length / 4).padStart(6)} cells  ` +
        `${kb(bytes).padStart(8)} (gzip ${kb(gz)})`,
    );
  }

  const yearList = [...years.keys()].sort((a, b) => a - b);
  await writeOut(
    'ged/index.json',
    JSON.stringify({
      cell: CELL,
      minYear: yearList[0],
      maxYear: yearList[yearList.length - 1],
      decades: index.map((d) => d.decade),
    }),
  );

  console.log(
    `\n${rows.toLocaleString()} rows → ${events.toLocaleString()} events → ` +
      `${totalCells.toLocaleString()} cell-years`,
  );
  console.log(
    `  ${kb(totalBytes)} raw, ${kb(totalGz)} gzipped · ` +
      `${(totalDeaths / 1e6).toFixed(2)}M deaths · ${dropped} rows dropped`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
