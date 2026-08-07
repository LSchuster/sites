/**
 * Compiles the hand-curated YAML conflict records into the single JSON file the
 * site loads at startup.
 *
 * The YAML is the source of truth, not this output: it carries comments explaining
 * why a contested figure was chosen, and it diffs readably in review. Never edit
 * public/data/conflicts.json by hand — it is generated.
 *
 * Run: npm run data:conflicts
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { ROOT, writeOut, kb } from './lib.ts';
import { germanNameMap } from './name-dictionary.ts';
import type { Conflict, ConflictTranslation } from '../src/types.ts';

const CURATED = resolve(ROOT, 'data/curated');
const I18N = resolve(CURATED, 'i18n');

async function main(): Promise<void> {
  const files = (await readdir(CURATED)).filter((f) => f.endsWith('.yaml')).sort();
  const conflicts: Conflict[] = [];

  for (const file of files) {
    const text = await readFile(resolve(CURATED, file), 'utf8');
    const parsed = parse(text) as Conflict[] | null;
    if (!parsed) {
      console.log(`  ${file.padEnd(28)} (empty)`);
      continue;
    }
    conflicts.push(...parsed);
    console.log(`  ${file.padEnd(28)} ${String(parsed.length).padStart(3)} conflicts`);
  }

  // Merge translations. Each data/curated/i18n/<locale>.yaml maps conflict id to
  // the fields that differ; anything absent falls back to English at runtime.
  let translationFiles: string[] = [];
  try {
    await stat(I18N);
    // names.*.yaml are name dictionaries (see name-dictionary.ts), not
    // per-conflict translation files.
    translationFiles = (await readdir(I18N)).filter(
      (f) => f.endsWith('.yaml') && !f.startsWith('names.'),
    );
  } catch {
    // No translations yet — English only.
  }

  const byId = new Map(conflicts.map((c) => [c.id, c]));
  for (const file of translationFiles) {
    const locale = file.replace(/\.yaml$/, '');
    const text = await readFile(resolve(I18N, file), 'utf8');
    const entries = (parse(text) ?? {}) as Record<string, ConflictTranslation>;
    let applied = 0;
    let unknown = 0;
    for (const [id, tr] of Object.entries(entries)) {
      const conflict = byId.get(id);
      if (!conflict) {
        unknown++;
        console.warn(`  ! ${file}: no conflict with id "${id}"`);
        continue;
      }
      conflict.i18n = { ...conflict.i18n, [locale]: tr };
      applied++;
    }
    const pct = ((applied / conflicts.length) * 100).toFixed(0);
    console.log(
      `  i18n/${file.padEnd(22)} ${String(applied).padStart(3)} of ${conflicts.length} (${pct}%)` +
        (unknown ? `  ${unknown} unknown ids` : ''),
    );
  }

  // Bake translated member names in from the shared dictionary. Positional
  // alignment with sides[i].members is safe because these arrays are generated,
  // never hand-written — and a name like "France" cannot end up translated
  // differently in different conflicts.
  const dict = await germanNameMap();
  const untranslated = new Set<string>();
  for (const c of conflicts) {
    const arrs = c.sides.map((s) => {
      if (!s.members?.length) return null;
      const tr = s.members.map((m) => {
        const g = dict.get(m);
        if (g === undefined && !/^[A-Z]{2,6}(-[A-Z])?$/.test(m)) untranslated.add(m);
        return g ?? m;
      });
      return tr.some((m, i) => m !== s.members![i]) ? tr : null;
    });
    if (arrs.some(Boolean)) {
      c.i18n = { ...c.i18n, de: { ...c.i18n?.de, members: arrs } };
    }
  }
  if (untranslated.size) {
    console.log(`  i18n/names.de.yaml: ${untranslated.size} member name(s) without a German entry:`);
    console.log(`    ${[...untranslated].sort().join(', ')}`);
  }

  conflicts.sort((a, b) => a.startYear - b.startYear || a.name.localeCompare(b.name));

  const json = JSON.stringify(conflicts);
  const bytes = await writeOut('conflicts.json', json);

  // Entries marked `partOf` are already inside a parent's total — summing them
  // would count the same deaths twice.
  const standalone = conflicts.filter((c) => !c.partOf);
  const nested = conflicts.length - standalone.length;
  const deaths = standalone.reduce((s, c) => s + c.total.best, 0);
  const low = standalone.reduce((s, c) => s + c.total.low, 0);
  const high = standalone.reduce((s, c) => s + c.total.high, 0);

  console.log(
    `\n${conflicts.length} conflicts · ${kb(bytes)}` +
      (nested ? ` · ${nested} nested inside a parent conflict` : ''),
  );
  console.log(
    `  deaths (excluding nested): ${(low / 1e6).toFixed(0)}M – ${(deaths / 1e6).toFixed(0)}M – ` +
      `${(high / 1e6).toFixed(0)}M  (low / best / high)`,
  );
  console.log(`  span: year ${conflicts[0]?.startYear} → ${Math.max(...conflicts.map((c) => c.endYear))}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
