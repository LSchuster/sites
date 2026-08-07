// Email header parsing: reconstruct the delivery path from Received: headers.
// Headers are stacked newest-first, so the path is the reversed list. Each
// Received header carries a timestamp after the final ';' — the deltas between
// consecutive stamps are *real* per-hop transit times, the one place where
// this app has measured rather than estimated latency.

import { isIp, isPrivateIp } from './parse';

export interface EmailHop {
  /** Sending host as claimed / observed, oldest hop first. */
  host?: string;
  ip?: string;
  by?: string;
  withProtocol?: string;
  date?: Date;
  raw: string;
  internal: boolean;
}

/** Unfold RFC 5322 headers (continuation lines start with whitespace). */
function unfold(raw: string): string[] {
  const lines: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && lines.length) {
      lines[lines.length - 1] += ' ' + line.trim();
    } else {
      lines.push(line);
    }
  }
  return lines;
}

const IP_IN_TEXT = /\[?((?:\d{1,3}\.){3}\d{1,3}|(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]+)\]?/gi;

function firstPublicIp(section: string): string | undefined {
  let fallback: string | undefined;
  for (const m of section.matchAll(IP_IN_TEXT)) {
    const ip = m[1];
    if (!ip || !isIp(ip)) continue;
    if (!isPrivateIp(ip)) return ip;
    fallback ??= ip;
  }
  return fallback;
}

export function parseEmailHeaders(raw: string): EmailHop[] {
  const received = unfold(raw)
    .filter((l) => /^received:/i.test(l))
    .map((l) => l.replace(/^received:\s*/i, ''));
  if (!received.length) {
    throw new Error('No Received: headers found. Paste the complete raw headers (or full source) of an email.');
  }

  // newest-first in the header block → reverse to chronological order
  const hops: EmailHop[] = [];
  for (const value of [...received].reverse()) {
    const semi = value.lastIndexOf(';');
    const datePart = semi >= 0 ? value.slice(semi + 1).trim() : '';
    const body = semi >= 0 ? value.slice(0, semi) : value;

    const fromMatch = /(?:^|\s)from\s+([^\s()]+)/i.exec(body);
    const byMatch = /(?:^|\s)by\s+([^\s()]+)/i.exec(body);
    const withMatch = /(?:^|\s)with\s+([A-Za-z0-9+._-]+)/i.exec(body);
    const fromSection = byMatch ? body.slice(0, byMatch.index) : body;
    const ip = firstPublicIp(fromSection) ?? firstPublicIp(body);
    const parsed = datePart ? new Date(datePart) : undefined;

    hops.push({
      host: fromMatch?.[1]?.replace(/[[\]]/g, ''),
      ip,
      by: byMatch?.[1],
      withProtocol: withMatch?.[1],
      date: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
      raw: value,
      internal: !ip || isPrivateIp(ip),
    });
  }
  return hops;
}
