import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = resolve(ROOT, 'data/raw');
export const OUT = resolve(ROOT, 'public/data');

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Fetch a URL, caching the body on disk under data/raw/.
 * Re-running a pipeline step should never re-download; these sources are large
 * and we want the scripts to be cheap to iterate on.
 */
export async function cachedFetch(url: string, cacheName: string): Promise<Buffer> {
  const path = resolve(RAW, cacheName);
  try {
    const info = await stat(path);
    if (info.size > 0) return await readFile(path);
  } catch {
    // not cached yet
  }
  await ensureDir(dirname(path));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
  return buf;
}

export async function writeOut(relPath: string, data: string | Buffer): Promise<number> {
  const path = resolve(OUT, relPath);
  await ensureDir(dirname(path));
  await writeFile(path, data);
  return Buffer.byteLength(data as string);
}

export const kb = (bytes: number): string => `${(bytes / 1024).toFixed(0)} KB`;

/** Round every coordinate to `dp` decimals, in place, to shrink JSON output. */
export function roundCoords(value: unknown, dp = 3): unknown {
  const f = 10 ** dp;
  const walk = (v: unknown): unknown => {
    if (typeof v === 'number') return Math.round(v * f) / f;
    if (Array.isArray(v)) return v.map(walk);
    return v;
  };
  return walk(value);
}
