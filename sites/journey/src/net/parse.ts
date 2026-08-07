// Input classification: URL vs bare IP vs pasted email headers.

export type TraceInput =
  | { kind: 'url'; url: URL }
  | { kind: 'ip'; ip: string }
  | { kind: 'email'; raw: string };

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
// Permissive on purpose — full IPv6 grammar is not worth hand-rolling here;
// anything that only contains hex groups and at least one ':' is treated as v6.
const IPV6_RE = /^[0-9a-f:]+$/i;

export function isIPv4(s: string): boolean {
  return IPV4_RE.test(s);
}

export function isIPv6(s: string): boolean {
  return s.includes(':') && IPV6_RE.test(s) && s.length >= 3;
}

export function isIp(s: string): boolean {
  return isIPv4(s) || isIPv6(s);
}

/** RFC 1918 / loopback / link-local / CGNAT / ULA — not publicly routable. */
export function isPrivateIp(ip: string): boolean {
  if (isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a = 0, b = 0] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const low = ip.toLowerCase();
  return low === '::1' || low.startsWith('fe80') || low.startsWith('fc') || low.startsWith('fd');
}

export function classifyInput(raw: string): TraceInput {
  const text = raw.trim();
  if (!text) throw new Error('Enter a URL, an IP address, or paste raw email headers.');

  if (/^received:/im.test(text) || /^delivered-to:/im.test(text)) {
    return { kind: 'email', raw: text };
  }

  const bare = text.replace(/^\[|\]$/g, '');
  if (isIp(bare)) return { kind: 'ip', ip: bare };

  if (!/\s/.test(text)) {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      throw new Error(`“${text}” doesn’t look like a URL, an IP address, or email headers.`);
    }
    if (!/^https?:$/.test(url.protocol)) {
      throw new Error(`Only http(s) URLs can be traced (got ${url.protocol}//).`);
    }
    if (!url.hostname.includes('.') && !isIp(url.hostname)) {
      throw new Error(`“${url.hostname}” is not a resolvable public hostname.`);
    }
    return { kind: 'url', url };
  }

  throw new Error('Could not recognize the input. Try a URL, an IP address, or full email headers.');
}
