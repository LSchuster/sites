// Best-effort round-trip measurement. A browser cannot ping, but it can time
// an opaque no-cors fetch to the destination origin: the response body is
// unreadable, yet the wall-clock time is real network latency (plus server
// processing). Minimum of several probes approximates RTT.

export interface RttResult {
  ms: number;
  probes: number;
}

export async function measureRtt(origin: string, probes = 4): Promise<RttResult | null> {
  if (!origin.startsWith('https://')) return null; // mixed content would be blocked
  const times: number[] = [];
  for (let i = 0; i < probes; i++) {
    const url = `${origin}/?__journey_probe=${i}`;
    const t0 = performance.now();
    try {
      await fetch(url, {
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      times.push(performance.now() - t0);
    } catch {
      // opaque failures (blocked, offline, timeout) — ignore this probe
    }
  }
  if (!times.length) return null;
  // First probe pays DNS + TLS setup; the minimum is closest to pure RTT.
  return { ms: Math.min(...times), probes: times.length };
}
