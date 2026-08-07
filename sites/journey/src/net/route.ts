// Route construction: turns a classified input into an ordered list of hops
// with coordinates, roles and timing estimates. Browsers cannot traceroute,
// so URL/IP routes are *estimates*: your geolocated position, your ISP, the
// nearest major internet exchanges, a mid-ocean transit waypoint on long
// paths, then the destination. Email routes are reconstructed from Received:
// headers and are as real as the headers themselves.

import {
  FIBER_KM_PER_MS,
  LIGHT_KM_PER_MS,
  greatCirclePoint,
  haversineKm,
} from '../geo/coords';
import { resolveHost, reverseLookup } from './dns';
import { parseEmailHeaders } from './email';
import { lookupIp, lookupSelf, type GeoInfo } from './geo';
import { IXPS, type Ixp } from './ixp';
import { measureRtt } from './latency';
import { isIp, type TraceInput } from './parse';

export type HopRole =
  | 'origin'
  | 'isp'
  | 'exchange'
  | 'transit'
  | 'cdn'
  | 'relay'
  | 'destination';

export interface Hop {
  role: HopRole;
  label: string;
  sub?: string;
  ip?: string;
  hostname?: string;
  asn?: string;
  org?: string;
  city?: string;
  region?: string;
  country?: string;
  cc?: string;
  lat: number;
  lon: number;
  /** True when the position is inferred rather than geolocated. */
  approx: boolean;
  note?: string;
  /** Measured time from the previous hop (email header deltas only). */
  hopMs?: number;
}

export interface RouteResult {
  kind: TraceInput['kind'];
  target: string;
  hops: Hop[];
  totalKm: number;
  countries: { name: string; cc: string }[];
  /** One-way, light in vacuum. */
  lightMs: number;
  /** One-way, light in optical fiber (~2/3 c). */
  fiberMs: number;
  /** Measured round-trip (no-cors probe) or total header transit time. */
  measuredMs?: number;
  measuredLabel?: string;
}

export type StatusFn = (message: string) => void;

const ROLE_NAMES: Record<HopRole, string> = {
  origin: 'Origin',
  isp: 'Access network',
  exchange: 'Internet exchange',
  transit: 'Backbone transit',
  cdn: 'CDN edge',
  relay: 'Mail relay',
  destination: 'Destination',
};

export function roleName(role: HopRole): string {
  return ROLE_NAMES[role];
}

const CDN_PATTERNS: [RegExp, string][] = [
  [/cloudflare/i, 'Cloudflare'],
  [/fastly/i, 'Fastly'],
  [/akamai/i, 'Akamai'],
  [/cloudfront|amazon|aws/i, 'Amazon CloudFront / AWS'],
  [/google/i, 'Google Cloud'],
  [/microsoft|azure/i, 'Microsoft Azure'],
  [/edgecast|verizon.*digital/i, 'Edgio'],
  [/bunny\s?(cdn|way)?/i, 'bunny.net'],
  [/cdn77/i, 'CDN77'],
  [/imperva|incapsula/i, 'Imperva'],
  [/netlify/i, 'Netlify'],
  [/vercel/i, 'Vercel'],
  [/github/i, 'GitHub Pages'],
  [/hetzner/i, 'Hetzner'],
  [/ovh/i, 'OVHcloud'],
  [/digitalocean/i, 'DigitalOcean'],
];

function detectProvider(geo: GeoInfo | null, ptr: string | null): string | null {
  const haystack = `${geo?.org ?? ''} ${geo?.isp ?? ''} ${ptr ?? ''}`;
  for (const [re, name] of CDN_PATTERNS) if (re.test(haystack)) return name;
  return null;
}

const ANYCAST_PROVIDERS = /cloudflare|fastly|akamai|google|cloudfront/i;

function nearestIxp(lat: number, lon: number, preferCc?: string): Ixp {
  let best = IXPS[0]!;
  let bestKm = Infinity;
  let bestHome: Ixp | null = null;
  let bestHomeKm = Infinity;
  for (const ix of IXPS) {
    const km = haversineKm(lat, lon, ix.lat, ix.lon);
    if (km < bestKm) {
      bestKm = km;
      best = ix;
    }
    if (preferCc && ix.cc === preferCc && km < bestHomeKm) {
      bestHomeKm = km;
      bestHome = ix;
    }
  }
  // Traffic usually enters the backbone in its own country: prefer a domestic
  // exchange unless it is a real detour.
  if (bestHome && bestHomeKm < bestKm * 1.6) return bestHome;
  return best;
}

function ixpHop(ix: Ixp, role: HopRole): Hop {
  return {
    role,
    label: ix.name,
    sub: `${ix.city}, ${ix.country}`,
    city: ix.city,
    country: ix.country,
    cc: ix.cc,
    lat: ix.lat,
    lon: ix.lon,
    approx: true,
    note: 'Estimated backbone waypoint — real paths depend on peering agreements.',
  };
}

function placeName(geo: GeoInfo): string {
  return [geo.city, geo.country].filter(Boolean).join(', ') || 'Unknown location';
}

/** Drop consecutive hops that sit on top of each other (< 60 km apart). */
function dedupe(hops: Hop[]): Hop[] {
  const out: Hop[] = [];
  for (const hop of hops) {
    const prev = out[out.length - 1];
    if (prev && haversineKm(prev.lat, prev.lon, hop.lat, hop.lon) < 60) {
      // keep the more specific of the two (prefer geolocated + labeled endpoints)
      if (hop.role === 'destination' || hop.role === 'cdn' || (!hop.approx && prev.approx)) {
        out[out.length - 1] = { ...hop, hopMs: hop.hopMs ?? prev.hopMs };
      }
      continue;
    }
    out.push(hop);
  }
  return out;
}

function finalize(
  kind: TraceInput['kind'],
  target: string,
  hops: Hop[],
  measuredMs?: number,
  measuredLabel?: string,
): RouteResult {
  let totalKm = 0;
  for (let i = 1; i < hops.length; i++) {
    const a = hops[i - 1]!;
    const b = hops[i]!;
    totalKm += haversineKm(a.lat, a.lon, b.lat, b.lon);
  }
  const countries: { name: string; cc: string }[] = [];
  for (const hop of hops) {
    if (hop.cc && hop.country && !countries.some((c) => c.cc === hop.cc)) {
      countries.push({ name: hop.country, cc: hop.cc });
    }
  }
  return {
    kind,
    target,
    hops,
    totalKm,
    countries,
    lightMs: totalKm / LIGHT_KM_PER_MS,
    fiberMs: totalKm / FIBER_KM_PER_MS,
    measuredMs,
    measuredLabel,
  };
}

// ---------------------------------------------------------------- URL / IP

async function buildIpRoute(
  destIp: string,
  display: { target: string; hostname?: string; origin?: string },
  kind: 'url' | 'ip',
  status: StatusFn,
): Promise<RouteResult> {
  status('Locating you (via your public IP)…');
  const self = await lookupSelf();

  status(`Locating ${destIp}…`);
  const [dest, ptr] = await Promise.all([lookupIp(destIp), reverseLookup(destIp)]);
  if (!dest) {
    throw new Error(
      `Could not geolocate ${destIp}. The lookup services may be rate-limited or blocked (ad blockers sometimes block ipwho.is / ipapi.co).`,
    );
  }

  const provider = detectProvider(dest, ptr);
  const anycast = provider !== null && ANYCAST_PROVIDERS.test(provider);

  const hops: Hop[] = [];

  if (self) {
    hops.push({
      role: 'origin',
      label: 'You',
      sub: placeName(self),
      ip: self.ip,
      org: self.org,
      asn: self.asn,
      city: self.city,
      region: self.region,
      country: self.country,
      cc: self.cc,
      lat: self.lat,
      lon: self.lon,
      approx: false,
      note: 'Position of your public IP as reported by the geolocation service — usually your ISP’s nearest city.',
    });

    const homeIx = nearestIxp(self.lat, self.lon, self.cc);
    if (self.isp || self.org) {
      // ISP core: nudged from your position toward the exchange so the hop is visible
      const step = greatCirclePoint(self.lat, self.lon, homeIx.lat, homeIx.lon, 0.25);
      hops.push({
        role: 'isp',
        label: self.isp ?? self.org ?? 'Your ISP',
        sub: `${self.asn ?? 'access network'} · regional core`,
        asn: self.asn,
        org: self.org,
        country: self.country,
        cc: self.cc,
        lat: step.lat,
        lon: step.lon,
        approx: true,
        note: 'Estimated position of your provider’s regional core network.',
      });
    }
    const usedIx = new Set<string>([homeIx.name]);
    hops.push(ixpHop(homeIx, 'exchange'));

    // Long haul: add a backbone waypoint near the great-circle midpoint when
    // it actually lies on the way (detour below ~35%).
    const directKm = haversineKm(homeIx.lat, homeIx.lon, dest.lat, dest.lon);
    if (directKm > 5000) {
      const mid = greatCirclePoint(homeIx.lat, homeIx.lon, dest.lat, dest.lon, 0.5);
      const via = nearestIxp(mid.lat, mid.lon);
      const detourKm =
        haversineKm(homeIx.lat, homeIx.lon, via.lat, via.lon) +
        haversineKm(via.lat, via.lon, dest.lat, dest.lon);
      if (!usedIx.has(via.name) && detourKm < directKm * 1.35) {
        usedIx.add(via.name);
        hops.push(ixpHop(via, 'transit'));
      }
    }

    const destIx = nearestIxp(dest.lat, dest.lon, dest.cc);
    if (!usedIx.has(destIx.name) && haversineKm(destIx.lat, destIx.lon, dest.lat, dest.lon) < 2500) {
      hops.push(ixpHop(destIx, 'exchange'));
    }
  }

  hops.push({
    role: anycast ? 'cdn' : 'destination',
    label: display.hostname ?? destIp,
    sub: provider ? `${provider} · ${placeName(dest)}` : placeName(dest),
    ip: destIp,
    hostname: ptr ?? display.hostname,
    org: dest.org,
    asn: dest.asn,
    city: dest.city,
    region: dest.region,
    country: dest.country,
    cc: dest.cc,
    lat: dest.lat,
    lon: dest.lon,
    approx: anycast,
    note: anycast
      ? `${provider} uses anycast: this IP answers from an edge near you, but geolocation databases register it at the location shown.`
      : undefined,
  });
  const deduped = dedupe(hops);

  let measuredMs: number | undefined;
  let measuredLabel: string | undefined;
  if (display.origin) {
    status(`Measuring round-trip time to ${display.hostname ?? destIp}…`);
    const rtt = await measureRtt(display.origin);
    if (rtt) {
      measuredMs = rtt.ms;
      measuredLabel = `min of ${rtt.probes} probes`;
    }
  }

  return finalize(kind, display.target, deduped, measuredMs, measuredLabel);
}

// ------------------------------------------------------------------- email

async function buildEmailRoute(raw: string, status: StatusFn): Promise<RouteResult> {
  status('Parsing Received: headers…');
  const parsed = parseEmailHeaders(raw);

  status(`Locating ${parsed.filter((h) => !h.internal).length} relay IPs…`);
  const geos = await Promise.all(parsed.map((h) => (h.internal || !h.ip ? null : lookupIp(h.ip))));

  const hops: Hop[] = [];
  let lastDate: Date | undefined;
  parsed.forEach((hop, i) => {
    const geo = geos[i] ?? null;
    let hopMs: number | undefined;
    if (hop.date && lastDate) hopMs = Math.max(0, hop.date.getTime() - lastDate.getTime());
    if (hop.date) lastDate = hop.date;

    if (!geo) {
      // Internal/unlocatable relay: anchor at the nearest located neighbour so
      // it still appears in the hop list without inventing a position.
      const anchor =
        hops[hops.length - 1] ??
        (() => {
          const j = geos.findIndex((g) => g);
          const g = j >= 0 ? geos[j] : null;
          return g ? ({ lat: g.lat, lon: g.lon } as Hop) : null;
        })();
      if (!anchor) return; // nothing located yet and nothing to anchor to
      hops.push({
        role: 'relay',
        label: hop.host ?? hop.by ?? 'Internal relay',
        sub: hop.ip ? `${hop.ip} · private network` : 'internal mail infrastructure',
        ip: hop.ip,
        hostname: hop.host,
        lat: anchor.lat,
        lon: anchor.lon,
        approx: true,
        note: 'Private or unlocatable address — shown at the nearest known relay.',
        hopMs,
      });
      return;
    }

    hops.push({
      role: i === 0 ? 'origin' : i === parsed.length - 1 ? 'destination' : 'relay',
      label: hop.host ?? geo.ip,
      sub: [geo.org ?? geo.isp, placeName(geo)].filter(Boolean).join(' · '),
      ip: hop.ip,
      hostname: hop.host,
      org: geo.org,
      asn: geo.asn,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      cc: geo.cc,
      lat: geo.lat,
      lon: geo.lon,
      approx: false,
      note: hop.withProtocol ? `Received with ${hop.withProtocol}.` : undefined,
      hopMs,
    });
  });

  if (hops.length < 2) {
    throw new Error(
      'Fewer than two relays could be located — the headers may only contain private-network hops.',
    );
  }
  const last = hops[hops.length - 1]!;
  if (last.role !== 'destination') last.role = 'destination';
  const first = hops[0]!;
  if (first.role !== 'origin') first.role = 'origin';

  const dates = parsed.map((h) => h.date).filter((d): d is Date => !!d);
  let measuredMs: number | undefined;
  let measuredLabel: string | undefined;
  const firstDate = dates[0];
  const lastDate2 = dates[dates.length - 1];
  if (firstDate && lastDate2 && dates.length >= 2) {
    measuredMs = Math.max(0, lastDate2.getTime() - firstDate.getTime());
    measuredLabel = 'total delivery time from header timestamps';
  }

  const target = last.hostname ?? last.label;
  return finalize('email', `mail to ${target}`, dedupe(hops), measuredMs, measuredLabel);
}

// ------------------------------------------------------------------ public

export async function buildRoute(input: TraceInput, status: StatusFn): Promise<RouteResult> {
  if (input.kind === 'email') return buildEmailRoute(input.raw, status);

  if (input.kind === 'ip') {
    return buildIpRoute(input.ip, { target: input.ip }, 'ip', status);
  }

  const host = input.url.hostname.replace(/^\[|\]$/g, '');
  let ip = host;
  if (!isIp(host)) {
    status(`Resolving ${host} via DNS-over-HTTPS…`);
    const ips = await resolveHost(host);
    const first = ips[0];
    if (!first) throw new Error(`DNS found no address for ${host}.`);
    ip = first;
  }
  return buildIpRoute(
    ip,
    { target: input.url.href, hostname: host, origin: input.url.origin },
    'url',
    status,
  );
}
