// Client-side IP geolocation. Primary: ipwho.is (free, CORS, no key).
// Fallback: ipapi.co (free tier, CORS). Results are cached per session; no
// lookup ever happens before the user starts a trace.

export interface GeoInfo {
  ip: string;
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  cc?: string;
  org?: string;
  isp?: string;
  asn?: string;
}

const cache = new Map<string, GeoInfo | null>();

interface IpWhoIs {
  success?: boolean;
  ip?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  connection?: { asn?: number; org?: string; isp?: string };
}

interface IpApiCo {
  error?: boolean;
  ip?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country_name?: string;
  country_code?: string;
  org?: string;
  asn?: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

async function fromIpWhoIs(path: string): Promise<GeoInfo> {
  const d = await getJson<IpWhoIs>(`https://ipwho.is/${path}`);
  if (d.success === false || typeof d.latitude !== 'number' || typeof d.longitude !== 'number') {
    throw new Error('ipwho.is: no location');
  }
  return {
    ip: d.ip ?? path,
    lat: d.latitude,
    lon: d.longitude,
    city: d.city,
    region: d.region,
    country: d.country,
    cc: d.country_code,
    org: d.connection?.org,
    isp: d.connection?.isp,
    asn: d.connection?.asn ? `AS${d.connection.asn}` : undefined,
  };
}

async function fromIpApiCo(path: string): Promise<GeoInfo> {
  const d = await getJson<IpApiCo>(`https://ipapi.co/${path}json/`);
  if (d.error || typeof d.latitude !== 'number' || typeof d.longitude !== 'number') {
    throw new Error('ipapi.co: no location');
  }
  return {
    ip: d.ip ?? path.replace(/\/$/, ''),
    lat: d.latitude,
    lon: d.longitude,
    city: d.city,
    region: d.region,
    country: d.country_name,
    cc: d.country_code,
    org: d.org,
    isp: d.org,
    asn: d.asn,
  };
}

/** Geolocate a public IP. Returns null when neither provider can place it. */
export async function lookupIp(ip: string): Promise<GeoInfo | null> {
  const cached = cache.get(ip);
  if (cached !== undefined) return cached;
  let info: GeoInfo | null = null;
  try {
    info = await fromIpWhoIs(ip);
  } catch {
    try {
      info = await fromIpApiCo(`${ip}/`);
    } catch {
      info = null;
    }
  }
  cache.set(ip, info);
  return info;
}

/** Geolocate the visitor (their public IP as seen by the service). */
export async function lookupSelf(): Promise<GeoInfo | null> {
  const cached = cache.get('self');
  if (cached !== undefined) return cached;
  let info: GeoInfo | null = null;
  try {
    info = await fromIpWhoIs('');
  } catch {
    try {
      info = await fromIpApiCo('');
    } catch {
      info = null;
    }
  }
  cache.set('self', info);
  return info;
}
