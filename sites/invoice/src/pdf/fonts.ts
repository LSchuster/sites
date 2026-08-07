/**
 * Load the subsetted Inter instances (see tools/fonts.mjs) as raw bytes.
 * Works in the browser (Vite rewrites the asset URLs, bytes come via fetch)
 * AND in Node (tools/gen-samples.mts reads from disk) so the golden-sample
 * validator can run the exact same generator code.
 */
const regularUrl = new URL('../assets/fonts/Inter-Regular.ttf', import.meta.url);
const semiboldUrl = new URL('../assets/fonts/Inter-SemiBold.ttf', import.meta.url);

async function loadOne(url: URL): Promise<Uint8Array> {
  if (typeof document !== 'undefined' || url.protocol !== 'file:') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font fetch failed: ${res.status} ${url.href}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  return new Uint8Array(await readFile(fileURLToPath(url)));
}

export interface FontBytes {
  regular: Uint8Array;
  semibold: Uint8Array;
}

export async function loadFontBytes(): Promise<FontBytes> {
  const [regular, semibold] = await Promise.all([loadOne(regularUrl), loadOne(semiboldUrl)]);
  return { regular, semibold };
}
