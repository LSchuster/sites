# journey — agent brief

Static, client-only interactive experience: enter a URL, IP address or raw email headers
and watch the *estimated* journey of that data across a cinematic 3D globe (three.js,
custom shaders, bloom pipeline). Vite + vanilla TypeScript, no framework, dark theme only.
`npm run dev` → http://localhost:5173.

## Hard rules

1. **No backend, ever.** All intelligence is client-side: DNS via DNS-over-HTTPS
   (dns.google → cloudflare-dns.com fallback), geolocation via ipwho.is → ipapi.co
   fallback, latency via timed opaque `no-cors` fetches. The CSP in `public/_headers`
   allows `connect-src https:` for exactly this — do not add servers, keys or analytics.
   Lookups run only when the user starts a trace; nothing the user enters is stored.
2. **Honesty about estimation is part of the product.** Browsers cannot traceroute.
   URL/IP routes are *plausible reconstructions* (you → ISP → internet exchanges →
   destination) built in `src/net/route.ts` over the IXP list in `src/net/ixp.ts`; every
   inferred hop carries `approx: true` and a `note`, and the footer says so. Never present
   estimated hops as measured. Email paths and their per-hop timings are the exception —
   they come from real `Received:` headers (`src/net/email.ts`).
3. **The globe data is generated, not hand-edited.** `public/earth/*.bin` (land bitmask +
   coastlines) is emitted by `npm run earth` (`tools/build-earth.mjs`) from the
   public-domain `world-atlas` package and committed. Change the format in the tool and
   the parser (`loadEarthData` in `src/scene/globe.ts`) together, then regenerate.
4. **Visual quality outranks feature count.** Everything renders through the composer
   (ACES + UnrealBloom + OutputPass); glow comes from shader colors >1.0, not extra
   passes. Keep the frame budget: land dots ≈ 48k points, arc tubes 90×6 segments,
   ambient packets < 300. Profile before raising any of these.
5. **Licence is MIT (per-site).** three.js is MIT, the GLSL simplex noise is webgl-noise
   (MIT, attributed in `src/scene/glsl.ts`), Natural Earth data is public domain. Do not
   add GPL dependencies.

## Layout

- `src/net/` — the estimation engine: `parse.ts` (input classification), `dns.ts` (DoH),
  `geo.ts` (IP → location, cached), `email.ts` (Received: parser), `ixp.ts` (exchange
  waypoints), `latency.ts` (RTT probe), `route.ts` (hop list builder — heart of the app)
- `src/scene/` — `globe.ts` (ocean shader, dot landmass, coastlines, clouds, halo),
  `arcs.ts` (route arcs, packets, markers, reveal timeline), `stars.ts`, `world.ts`
  (renderer/composer/camera choreography/picking), `glsl.ts` (shared noise)
- `src/ui/` — `hud.ts` (stats/timeline/detail DOM), `format.ts`, `samples.ts`
- `src/geo/coords.ts` — lat/lon ↔ vector, haversine, great-circle; physical constants
- `index.html` — all static markup; `src/style.css` — all styling, no CSS framework

## Before you call it done

```bash
npx tsc --noEmit   # strict; noUncheckedIndexedAccess is on
npm run build      # must succeed
```

Then in `npm run dev`, run all three sample chips (URL / IP / email) and check: globe
renders with dots + coastlines, route reveals hop by hop with a moving packet, stats
count up, hops are clickable with the camera flying in. The email sample must show
per-hop `+time` deltas from header timestamps.
