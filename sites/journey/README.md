# Journey — How Far Did This Message Travel?

Enter a **URL**, an **IP address**, or paste **raw email headers** — and watch the
estimated journey of that data across the internet as an animated route on a cinematic
3D globe: your location, your ISP, the internet exchanges in between, CDN edges, and the
destination server, with distance, hop count, countries crossed, light-speed timing and
(where possible) measured latency.

Runs entirely in the browser. No backend, no accounts, no storage.

## How it works

Browsers cannot run a real traceroute, so Journey reconstructs a *plausible, estimated*
route and is explicit about that:

| Input | What happens |
|---|---|
| URL | Hostname resolved via DNS-over-HTTPS (dns.google, cloudflare-dns.com fallback); destination IP geolocated (ipwho.is, ipapi.co fallback); route estimated through your ISP and the nearest major internet exchange points; CDN/anycast providers detected from ASN/PTR data; round-trip time measured with opaque `no-cors` fetch probes. |
| IP address | Geolocated directly; same estimated exchange-point routing. |
| Email headers | The real delivery path is reconstructed from `Received:` headers, each relay geolocated, and per-hop transit times computed from the genuine header timestamps. |

Stats shown: total great-circle distance, hop count, countries touched, theoretical
one-way time at light speed in fiber (~⅔ c) and in vacuum, plus measured RTT (URL) or
total delivery time (email).

The globe (dot-matrix continents, coastlines, atmosphere, clouds, city lights) is built
from Natural Earth public-domain data, preprocessed by `npm run earth` into compact
binaries in `public/earth/`. Rendering is three.js with custom shaders and a bloom
pipeline.

## Privacy

Nothing you enter is stored or sent anywhere except the lookups that power the trace
itself (DoH queries for hostnames you trace, geolocation queries for the IPs involved —
including your own public IP, queried only when you start a trace — and timing probes to
the traced destination).

## Develop

```bash
npm ci
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build → dist/
npm run earth    # regenerate public/earth/*.bin from world-atlas (rarely needed)
```

## Licence

MIT (see `LICENSE`). three.js (MIT), GLSL simplex noise from webgl-noise (MIT),
Natural Earth data via `world-atlas` (public domain).
