// DNS-over-HTTPS lookups. Google's JSON endpoint is primary, Cloudflare's is
// the fallback — both are CORS-enabled and need no key. Browsers cannot issue
// raw DNS queries, so DoH is the only client-side option.

import { isIPv4 } from './parse';

interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

async function query(name: string, type: string): Promise<DohAnswer[]> {
  const attempts = [
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  ];
  let lastError: unknown = null;
  for (const url of attempts) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`DoH ${res.status}`);
      const json = (await res.json()) as { Answer?: DohAnswer[] };
      return json.Answer ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`DNS lookup failed for ${name}: ${String(lastError)}`);
}

/** Resolve a hostname to its public addresses (A first, AAAA as fallback). */
export async function resolveHost(hostname: string): Promise<string[]> {
  const a = await query(hostname, 'A');
  const v4 = a.filter((r) => r.type === 1 && isIPv4(r.data)).map((r) => r.data);
  if (v4.length) return v4;
  const aaaa = await query(hostname, 'AAAA');
  return aaaa.filter((r) => r.type === 28).map((r) => r.data);
}

/** Reverse (PTR) lookup; returns null when there is no record. */
export async function reverseLookup(ip: string): Promise<string | null> {
  let arpa: string;
  if (isIPv4(ip)) {
    arpa = ip.split('.').reverse().join('.') + '.in-addr.arpa';
  } else {
    const full = expandIPv6(ip);
    if (!full) return null;
    arpa = full.replace(/:/g, '').split('').reverse().join('.') + '.ip6.arpa';
  }
  try {
    const answers = await query(arpa, 'PTR');
    const ptr = answers.find((r) => r.type === 12);
    return ptr ? ptr.data.replace(/\.$/, '') : null;
  } catch {
    return null;
  }
}

function expandIPv6(ip: string): string | null {
  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const groups = [...head, ...Array(missing).fill('0'), ...tail];
  return groups.map((g) => g.padStart(4, '0')).join(':');
}
