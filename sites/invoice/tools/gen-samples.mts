// Generate golden sample e-invoices (PDF + standalone XML) from the JSON
// fixtures in samples/. Runs the EXACT same generator code as the browser.
//
//   npx tsx tools/gen-samples.mts
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serializeCii } from '../src/cii/serialize';
import { computeTotals } from '../src/model/compute';
import type { Invoice } from '../src/model/invoice';
import { validateInvoice } from '../src/model/validate';
import { generateInvoicePdf } from '../src/pdf/generate';

const samplesDir = fileURLToPath(new URL('../samples/', import.meta.url));
const outDir = fileURLToPath(new URL('../samples/out/', import.meta.url));
await mkdir(outDir, { recursive: true });

const files = (await readdir(samplesDir)).filter((f) => f.endsWith('.json'));
if (files.length === 0) throw new Error('no sample fixtures found');

let failed = false;
for (const file of files.sort()) {
  const name = file.replace(/\.json$/, '');
  const invoice = JSON.parse(await readFile(samplesDir + file, 'utf8')) as Invoice;

  const issues = validateInvoice(invoice);
  if (issues.length > 0) {
    console.error(`✗ ${name}: fixture fails form validation:`, issues);
    failed = true;
    continue;
  }

  const totals = computeTotals(invoice);
  const pdf = await generateInvoicePdf(invoice);
  await writeFile(`${outDir}${name}.pdf`, pdf);
  await writeFile(`${outDir}${name}.xml`, serializeCii(invoice));
  console.log(
    `✓ ${name}: net ${(totals.netCents / 100).toFixed(2)} € · vat ${(totals.vatCents / 100).toFixed(2)} € · gross ${(totals.grossCents / 100).toFixed(2)} € · pdf ${(pdf.length / 1024).toFixed(0)} kB`,
  );
}

if (failed) process.exit(1);
