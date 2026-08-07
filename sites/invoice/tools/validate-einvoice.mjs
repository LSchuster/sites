// Validate the golden sample e-invoices in samples/out/ with the
// Mustangproject CLI (embedded veraPDF for PDF/A-3 + the official EN 16931 /
// ZUGFeRD schematron). Dev-time / CI gate only — never part of the site.
//
//   npm run validate:einvoice     (runs gen-samples first via package.json)
//
// Requires Java 17+ on PATH (CI: actions/setup-java; local: e.g. Temurin).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MUSTANG_VERSION = '2.25.0';
const MUSTANG_URL = `https://github.com/ZUGFeRD/mustangproject/releases/download/core-${MUSTANG_VERSION}/Mustang-CLI-${MUSTANG_VERSION}.jar`;
const MUSTANG_SHA256 = 'd68b9fd6a9948a0964b7c93ed06b7e903a6dbafcd0df581e992e3178bf016701';

const cacheDir = fileURLToPath(new URL('./cache/', import.meta.url));
const outDir = fileURLToPath(new URL('../samples/out/', import.meta.url));
const jarPath = `${cacheDir}Mustang-CLI.jar`;

const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
if (java.error) {
  console.error(
    'java not found on PATH — install a JDK (e.g. Eclipse Temurin 21) to run the e-invoice validation.',
  );
  process.exit(2);
}

await mkdir(cacheDir, { recursive: true });
if (!existsSync(jarPath)) {
  console.log(`downloading Mustang-CLI ${MUSTANG_VERSION} …`);
  const res = await fetch(MUSTANG_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  await writeFile(jarPath, Buffer.from(await res.arrayBuffer()));
}
const hash = createHash('sha256').update(await readFile(jarPath)).digest('hex');
if (hash !== MUSTANG_SHA256) {
  console.error(`Mustang-CLI.jar SHA-256 mismatch:\n  got      ${hash}\n  expected ${MUSTANG_SHA256}`);
  process.exit(2);
}

const pdfs = (await readdir(outDir)).filter((f) => f.endsWith('.pdf')).sort();
if (pdfs.length === 0) {
  console.error('no PDFs in samples/out/ — run `npm run samples` first.');
  process.exit(2);
}

let failures = 0;
for (const pdf of pdfs) {
  const result = spawnSync(
    'java',
    ['-Xmx1G', '-jar', jarPath, '--no-notices', '--action', 'validate', '--source', outDir + pdf],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const report = `${result.stdout}\n${result.stderr}`;
  const invalid = result.status !== 0 || /status="invalid"/.test(report);
  if (invalid) {
    failures += 1;
    console.error(`✗ ${pdf}`);
    // Surface only the error lines, not the whole XML report.
    for (const line of report.split('\n')) {
      if (/<error|criterion|severity="error"|Exception/.test(line)) console.error(`   ${line.trim()}`);
    }
  } else {
    console.log(`✓ ${pdf}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${pdfs.length} sample(s) failed validation.`);
  process.exit(1);
}
console.log(`\nall ${pdfs.length} samples valid (PDF/A-3 + EN 16931).`);
