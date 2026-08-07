/**
 * Data invariants. Runs in CI; a failure should block a deploy.
 *
 * Historical data fails quietly — a transposed coordinate puts a battle in the
 * ocean and nothing throws. These checks exist to make that loud.
 *
 * Run: npm run data:validate
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { OUT, ROOT } from './lib.ts';
import { canonical } from './entities.ts';
import type { Conflict, CasualtyRange } from '../src/types.ts';

const errors: string[] = [];
const warnings: string[] = [];

const err = (id: string, msg: string) => errors.push(`${id}: ${msg}`);
const warn = (id: string, msg: string) => warnings.push(`${id}: ${msg}`);

function checkRange(id: string, label: string, r: CasualtyRange | undefined): void {
  if (!r) return;
  if (!(r.low <= r.best && r.best <= r.high)) {
    err(id, `${label} range not ordered: low=${r.low} best=${r.best} high=${r.high}`);
  }
  if (r.low < 0) err(id, `${label} has negative low`);
  if (!['documented', 'estimated', 'disputed'].includes(r.confidence)) {
    err(id, `${label} has invalid confidence "${r.confidence}"`);
  }
}

/**
 * Border snapshot invariants: every named feature must carry the build-time
 * entity id, tint slot, and label anchor; the same canonical name must map to
 * one entity everywhere (tint continuity is the whole point of the pass); and
 * anchors must sit inside their feature's bounding box.
 */
async function validateBorders(): Promise<void> {
  const index = JSON.parse(
    await readFile(resolve(OUT, 'borders/index.json'), 'utf8'),
  ) as { years: number[] };
  if (!index.years.length) err('borders', 'index.json lists no snapshots');

  const entityByName = new Map<string, { entity: number; year: number }>();
  const colorByEntity = new Map<number, { color: number; year: number }>();

  for (const year of index.years) {
    const id = `borders/${year}`;
    const topo = JSON.parse(
      await readFile(resolve(OUT, `borders/world_${year}.topo.json`), 'utf8'),
    ) as Topology;
    const obj = topo.objects['world'];
    if (!obj) {
      err(id, 'no "world" object');
      continue;
    }
    const fc = feature(topo, obj) as unknown as {
      features: {
        properties: Record<string, unknown> | null;
        geometry: { coordinates: unknown } | null;
      }[];
    };
    for (const f of fc.features) {
      const p = f.properties ?? {};
      const name = (p['n'] ?? null) as string | null;
      const prec = Number(p['p'] ?? NaN);
      if (!(prec >= 0 && prec <= 6)) err(id, `"${name ?? '?'}" precision ${prec} out of range`);
      if (!name) continue;

      const entity = p['e'];
      const color = p['c'];
      const anchor = p['l'] as [number, number] | undefined;
      const area = p['a'];
      if (typeof entity !== 'number' || entity < 0) {
        err(id, `named feature "${name}" missing entity id`);
        continue;
      }
      if (typeof color !== 'number' || color < 0 || color > 6) {
        err(id, `"${name}" tint slot ${String(color)} outside 0..6`);
      }
      if (typeof area !== 'number' || area < 0) err(id, `"${name}" missing area`);

      const canon = canonical(name);
      const prior = entityByName.get(canon);
      if (prior && prior.entity !== entity) {
        err(id, `"${name}" is entity ${entity} here but ${prior.entity} in ${prior.year}`);
      } else if (!prior) {
        entityByName.set(canon, { entity, year });
      }
      const priorColor = colorByEntity.get(entity);
      if (priorColor && typeof color === 'number' && priorColor.color !== color) {
        err(id, `entity ${entity} ("${name}") tinted ${color} here but ${priorColor.color} in ${priorColor.year}`);
      } else if (!priorColor && typeof color === 'number') {
        colorByEntity.set(entity, { color, year });
      }

      if (anchor) {
        const [alon, alat] = anchor;
        if (!(alon >= -180 && alon <= 180 && alat >= -90 && alat <= 90)) {
          err(id, `"${name}" label anchor ${alon},${alat} off the globe`);
        } else if (f.geometry) {
          let lonMin = Infinity;
          let lonMax = -Infinity;
          let latMin = Infinity;
          let latMax = -Infinity;
          const walk = (v: unknown): void => {
            if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number') {
              lonMin = Math.min(lonMin, v[0]);
              lonMax = Math.max(lonMax, v[0]);
              latMin = Math.min(latMin, v[1] as number);
              latMax = Math.max(latMax, v[1] as number);
            } else if (Array.isArray(v)) {
              for (const x of v) walk(x);
            }
          };
          walk(f.geometry.coordinates);
          // Half-degree slack: anchors are rounded to 0.1° and simplification
          // nudges outlines.
          if (
            alon < lonMin - 0.5 || alon > lonMax + 0.5 ||
            alat < latMin - 0.5 || alat > latMax + 0.5
          ) {
            err(id, `"${name}" label anchor ${alon},${alat} outside its feature bbox`);
          }
        }
      }
    }
  }

  // The entities report is a build cache, absent in a fresh checkout — skip
  // rather than fail, the adjacency rate is advisory anyway.
  try {
    const report = JSON.parse(
      await readFile(resolve(ROOT, 'data/cache/entities-report.json'), 'utf8'),
    ) as { sameColorAdjacency: number };
    if (report.sameColorAdjacency > 0.08) {
      warn(
        'borders',
        `same-tint adjacency ${(report.sameColorAdjacency * 100).toFixed(1)}% exceeds 8%`,
      );
    }
  } catch {
    /* report not present */
  }

  console.log(
    `Validated ${index.years.length} border snapshots — ` +
      `${entityByName.size} named polities, ${colorByEntity.size} entities.`,
  );
}

async function main(): Promise<void> {
  await validateBorders();

  const raw = await readFile(resolve(OUT, 'conflicts.json'), 'utf8');
  const conflicts = JSON.parse(raw) as Conflict[];

  const seen = new Set<string>();
  const allIds = new Set(conflicts.map((c) => c.id));
  const currentYear = new Date().getFullYear();

  for (const c of conflicts) {
    const id = c.id || '(missing id)';

    if (!c.id) err('(anonymous)', 'missing id');
    if (seen.has(c.id)) err(id, 'duplicate id');
    seen.add(c.id);

    if (!c.name) err(id, 'missing name');
    if (c.endYear < c.startYear) err(id, `endYear ${c.endYear} < startYear ${c.startYear}`);
    if (c.startYear < 0) err(id, `startYear ${c.startYear} predates the atlas (year 0)`);
    if (c.endYear > currentYear) err(id, `endYear ${c.endYear} is in the future`);

    const [lon, lat] = c.centroid ?? [NaN, NaN];
    if (!(lon >= -180 && lon <= 180)) err(id, `longitude ${lon} out of range`);
    if (!(lat >= -90 && lat <= 90)) err(id, `latitude ${lat} out of range`);
    // A conflict at exactly 0,0 is in the Gulf of Guinea — almost always a
    // forgotten placeholder rather than a real location.
    if (lon === 0 && lat === 0) warn(id, 'centroid is 0,0 — placeholder?');

    if (c.partOf) {
      if (!allIds.has(c.partOf)) err(id, `partOf references unknown conflict "${c.partOf}"`);
      if (c.partOf === c.id) err(id, 'partOf points at itself');
    }

    if (!c.sources?.length) err(id, 'has no sources');
    if (!c.sides?.length) err(id, 'has no sides');
    if (c.sides?.length === 1) warn(id, 'has only one side');

    checkRange(id, 'total', c.total);
    for (const side of c.sides ?? []) {
      if (!side.name) err(id, 'a side is missing a name');
      checkRange(id, `side "${side.name}" military`, side.military);
      checkRange(id, `side "${side.name}" civilian`, side.civilian);
    }

    // Per-side figures should not exceed the stated total by more than rounding
    // slack — if they do, one of the two numbers is wrong.
    const sideSum = (c.sides ?? []).reduce(
      (s, side) => s + (side.military?.best ?? 0) + (side.civilian?.best ?? 0),
      0,
    );
    if (sideSum > 0 && c.total.best > 0 && sideSum > c.total.best * 1.15) {
      warn(
        id,
        `side casualties sum to ${sideSum.toLocaleString()} but total is ${c.total.best.toLocaleString()}`,
      );
    }

    for (const [locale, tr] of Object.entries(c.i18n ?? {})) {
      // Side labels are matched to sides by position, so a count mismatch puts
      // every label after the split onto the wrong belligerent. The usual cause
      // is an unquoted comma inside a name in a YAML flow sequence.
      if (tr.sides && tr.sides.length !== (c.sides?.length ?? 0)) {
        err(
          id,
          `i18n/${locale} has ${tr.sides.length} sides but the conflict has ${c.sides?.length ?? 0} — ` +
            `unquoted comma in a YAML flow sequence?`,
        );
      }
      if (tr.members) {
        if (tr.members.length !== (c.sides?.length ?? 0)) {
          err(id, `i18n/${locale} members has ${tr.members.length} entries for ${c.sides?.length ?? 0} sides`);
        }
        tr.members.forEach((arr, i) => {
          const expected = c.sides?.[i]?.members?.length ?? 0;
          if (arr && arr.length !== expected) {
            err(id, `i18n/${locale} members[${i}] has ${arr.length} names but side has ${expected}`);
          }
        });
      }
      if (locale === 'de') {
        for (const [field, text] of [['name', tr.name], ['summary', tr.summary]] as const) {
          if (text && text.includes('„') && text.includes('"')) {
            warn(id, `i18n/de ${field} mixes German „ with an ASCII " quote`);
          }
        }
      }
    }
  }

  // Per-field translation coverage. The compile step's percentage only says an
  // entry with the id exists; this says which fields it actually carries.
  const locales = new Set(conflicts.flatMap((c) => Object.keys(c.i18n ?? {})));
  for (const locale of [...locales].sort()) {
    const fields = ['name', 'region', 'summary', 'sides'] as const;
    const counts = fields.map(
      (f) => conflicts.filter((c) => c.i18n?.[locale]?.[f] != null).length,
    );
    console.log(
      `i18n/${locale} field coverage of ${conflicts.length}: ` +
        fields.map((f, i) => `${f} ${counts[i]}`).join(' · '),
    );
    fields.forEach((f, i) => {
      if (counts[i] !== conflicts.length) {
        const missing = conflicts.filter((c) => c.i18n?.[locale]?.[f] == null).map((c) => c.id);
        console.log(`  ~ ${f} missing for: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ` … +${missing.length - 10}` : ''}`);
      }
    });
  }

  console.log(`Validated ${conflicts.length} conflicts.`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ~ ${w}`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log('\nAll invariants hold.');
}

main().catch((err_: unknown) => {
  console.error(err_);
  process.exit(1);
});
