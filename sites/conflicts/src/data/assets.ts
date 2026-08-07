/** Resolve a path under public/data/, honouring Vite's configured base. */
export function dataUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/data/${path.replace(/^\//, '')}`;
}

const inflight = new Map<string, Promise<unknown>>();

/** Fetch-and-cache JSON. Concurrent callers for the same URL share one request. */
export function loadJson<T>(path: string): Promise<T> {
  const url = dataUrl(path);
  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;
  const p = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json() as Promise<T>;
  });
  inflight.set(url, p);
  return p;
}
