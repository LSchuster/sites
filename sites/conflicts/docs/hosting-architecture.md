# Hosting architecture

Status: **plan, not yet implemented** · Written 2026-08-07 · Prices and free-tier limits were
verified on that date and drift — re-check before acting on a number.

This doc answers: where the site runs, what it costs, how deploys happen, and what keeps it
safe. Launch steps and sequencing live in `publication-plan.md`; the task breakdown an agent
can execute lives in `implementation-roadmap.md`.

**Monorepo context (added 2026-08-07):** the repo is a multi-site monorepo — each site
self-contained under `sites/<name>/`, each deployed to `<name>.<umbrella>.io`, one shared
umbrella domain for everything (rationale in `publication-plan.md` § The domain). This doc
is written from `sites/conflicts/` but the account/zone/CI model it describes **is the
umbrella model for every site in the repo**. Paths are relative to `sites/conflicts/`
unless they start with `sites/` or `.github/`.

---

## What the repo actually needs from a host

Derived from the codebase, not aspiration:

- **Pure static output.** `npm run build` (`tsc -b && vite build`) emits `dist/`. No server,
  no functions, no runtime secrets (`README.md`, CLAUDE.md hard rule 2).
- **`public/` is 13 MB across 231 files**, largest file well under 20 MB. Any static host's
  per-file and file-count limits are comfortable.
- **Bandwidth is the one number that matters.** First paint is ~230 KB gzipped, but a session
  that scrubs the full timeline pulls border snapshots (~2.1 MB gz total), UCDP cells (271 KB),
  battles (90 KB), terrain (250 KB), flags on hover. Budget **~1 MB average, ~3 MB worst case
  per session**. A single viral spike (50k visits in a weekend) ≈ 50–150 GB — this is what
  disqualifies capped free tiers.
- **`vite.config.ts` uses `base: './'`** — the build runs unchanged from any host, CDN, or
  subdirectory. Host portability is already built in; nothing may reintroduce absolute paths.
- **`public/data/` is committed**, so CI needs only `npm ci && npm run build` executed
  inside `sites/conflicts/`. The data pipeline (raw 239 MB UCDP CSV, Wikidata SPARQL)
  never runs in CI — keep it that way.
- **Each site is self-contained** (own `package.json` + lockfile, no npm workspaces —
  repo-root CLAUDE.md rule). This is what lets Cloudflare Pages build a site with its
  "root directory" setting and a plain `npm ci`.
- **Commercial use must be permitted** on whatever tier hosts it (monetization is planned —
  see `commercialization-plan.md`).

## Recommendation: Cloudflare Pages + Cloudflare DNS/Registrar

**Primary: Cloudflare Pages, free plan.** Decisive reasons, in order:

1. **Unlimited bandwidth and requests on the free plan.** The only mainstream free tier where
   a front-page-of-Hacker-News weekend cannot produce a bill or a suspension. Given the
   ~1–3 MB/session data payload, this outweighs every other differentiator.
2. Free plan explicitly allows commercial projects (unlike Vercel Hobby).
3. `_headers` file support → real cache-control and security headers (GitHub Pages cannot).
4. Global CDN, automatic SSL, HTTP/3, Brotli — nothing to configure.
5. Cloudflare Web Analytics: free, cookie-less, GDPR-friendly → no consent banner needed.
6. Growth path without migration: Workers (if an API ever exists), R2 (raw-data archive),
   all under the same account.
7. The umbrella-domain model fits natively: one Cloudflare zone, unlimited free
   subdomains, free Universal SSL for all first-level subdomains, and up to 100 Pages
   projects per account — registrar + DNS + hosting + analytics for *every* site in the
   repo collapse into one free account. (Constraint to respect: only **first-level**
   subdomains get free SSL — `conflicts.<umbrella>.io` yes, `a.b.<umbrella>.io` no.)

Free-plan limits that matter (verified 2026-08 against the live pricing page): 500
builds/month (1 concurrent), 20,000 files/deploy, 25 MiB/file, 100 custom domains/project,
unlimited sites/requests/bandwidth. SSL certificates are included free (Universal SSL,
auto-renewing, covers first-level subdomains) — never buy a certificate from a registrar
upsell. The repo uses ~231 files and a handful of builds per week — an order of magnitude
of headroom everywhere.

### Topology

```
GitHub monorepo (source of truth, incl. each site's committed data)
   │  push to main
   ├─▶ GitHub Actions — checks only, path-filtered per site
   │        conflicts job: cd sites/conflicts → tsc -b, vite build, data:validate
   └─▶ Cloudflare Pages — one project PER SITE, Git integration
            project "conflicts":  root dir sites/conflicts,
            build watch paths sites/conflicts/*  → npm ci && npm run build → dist/ → edge
            project "<next-site>": root dir sites/<next-site>, …
              │
   <umbrella>.io zone (Cloudflare Registrar + DNS, one registration for all sites)
     ├─ conflicts.<umbrella>.io  → Pages project "conflicts"   (Universal SSL, HSTS)
     ├─ <next>.<umbrella>.io     → Pages project "<next-site>"
     └─ apex <umbrella>.io       → optional tiny index page listing the sites (later)
              │
   Cloudflare Web Analytics (beacon per site, cookie-less)
```

- PRs get automatic **preview deployments** (unique URL per branch) from Pages — screenshot
  review with `tools/shot.mjs <preview-url> …` becomes possible pre-merge.
- **Build watch paths** (`sites/conflicts/*`) stop pushes that only touch other sites from
  burning this project's builds — relevant once a second site exists (500 builds/mo are
  shared per account).
- No `_redirects` needed: the app is a single page; permalinks use `location.hash`. Pages
  serves `index.html` for unknown paths when no `404.html` exists, which is the behaviour we
  want — do not add a `404.html`.

### Cloudflare Pages settings (for the agent that sets it up)

| Setting | Value |
|---|---|
| Root directory | `sites/conflicts` |
| Build command | `npm run build` |
| Output directory | `dist` (relative to root directory) |
| Build watch paths | include `sites/conflicts/*` |
| Environment | `NODE_VERSION=22` (matches local v22.13; add `"engines": {"node": ">=22"}` to package.json) |
| Production branch | `main` |
| Custom domain | `conflicts.<umbrella>.io` (after roadmap P0-2 picks the umbrella) |

## Alternatives compared

| Host | Free bandwidth | Commercial OK | Custom headers | Verdict |
|---|---|---|---|---|
| **Cloudflare Pages** | Unlimited | Yes | Yes (`_headers`) | **Recommended** |
| Netlify Starter | 100 GB/mo, then paid | Yes | Yes | Solid runner-up; 100 GB ≈ one good spike, overage risk. Use if avoiding Cloudflare. |
| Vercel Hobby | 100 GB/mo | **No — ToS bans commercial use** | Yes | Excluded: monetization is planned, so the free tier is contractually unusable; Pro is $20/mo for nothing this repo needs. |
| GitHub Pages | ~100 GB/mo soft cap | Tolerated for donations, not shops | **No** | Fine as a zero-config *mirror*; no headers, no analytics, weaker CDN. Not primary. |
| S3 + CloudFront | Pay per GB (~$0.09/GB egress) | Yes | Yes | Strictly worse: real ops burden and the only option that *scales cost with traffic*. No. |
| Bunny.net / Hetzner (EU) | ~€1–5/mo minimums | Yes | Yes | Legitimate choice if EU-only data processing becomes a hard requirement. More setup, small cost. Revisit only if a GDPR review demands it — Cloudflare with cookie-less analytics is defensible as-is. |

## Costs

Static architecture means hosting cost is essentially **flat at zero**; the domain is the
only fixed cost — and under the umbrella model it is paid **once for every site in the
repo**. `.io` is an expensive TLD: ~$50–60/yr renewal (verified 2026-08; first-year teaser
prices are lower, ignore them); subdomains, SSL, and additional Pages projects are free, so
**the marginal infrastructure cost of each additional site is €0**. The optional
conflicts.io redemption rescue, if taken, is a one-off ~$80–120 + renewal (registry fee —
confirm with Cloudflare). The domain line below is therefore a repo-wide cost, not
per-site:

| Traffic stage | Assumption | Hosting | Domain | Optional tooling | Total/mo |
|---|---|---|---|---|---|
| Launch (≤10k visits/mo) | ≤10 GB transfer | €0 (CF Pages free) | ~€4.50 | €0 (CF Analytics, UptimeRobot free) | **~€5** |
| Moderate (10–100k visits/mo) | ≤150 GB, spiky | €0 — still free tier | ~€4.50 | €0–9 (Plausible analytics if wanted) | **~€5–14** |
| Growing (100k–1M visits/mo) | ≤1.5 TB, spiky | €0 — bandwidth still uncapped | ~€4.50 | €0–30 (paid analytics tier, Sentry paid, Workers $5 if an API ships) | **~€5–35** |

The same traffic on S3+CloudFront would be ~$10/mo at moderate and ~$100+/mo at growing —
that difference *is* the architecture decision, already made by keeping the site static.

## CI/CD and update strategy

Two independent lanes, both triggered by git push:

1. **Checks lane — GitHub Actions** (`.github/workflows/ci.yml`, to be created): one job
   per site, each path-filtered (`paths: sites/conflicts/**` via `dorny/paths-filter` or
   per-workflow `on.push.paths`) and running with
   `defaults.run.working-directory: sites/conflicts`: `npm ci` → `npm run build` (runs
   `tsc -b` first) → `npm run data:validate`. Node 22. Public repo ⇒ Actions minutes are
   free. A new site = copy the job, change the folder.
2. **Deploy lane — Cloudflare Pages Git integration**: one project per site (root
   directory + build watch paths per the settings table), `main` → production, every
   branch → preview URL. No secrets in the repo; the Pages↔GitHub link is configured
   once in the dashboard. (Alternative if more control is ever needed: deploy from Actions
   with `wrangler pages deploy` and a `CLOUDFLARE_API_TOKEN` secret — not needed at launch.)

**Content/data updates** follow the existing contract: edit `data/curated/*.yaml` → run the
pipeline locally → commit regenerated `public/data/` → push → auto-deploy. CI never runs the
pipeline; `data:validate` in CI is a cheap re-check of committed output.

**Rollback** = redeploy a previous deployment in the Pages dashboard (one click, instant) or
`git revert` + push.

**Dataset refresh cadence**: UCDP GED releases annually (~June/July). One planned refresh per
year, plus curated-conflict additions whenever. See the runbook task in
`implementation-roadmap.md` (P2-5).

## Caching and headers

Ship `public/_headers` (Vite copies `public/` verbatim into `dist/`):

- `/assets/*` (hash-named by Vite): `Cache-Control: public, max-age=31536000, immutable`.
- `/data/*` (stable names, change on data refresh): `Cache-Control: public, max-age=3600,
  stale-while-revalidate=86400` — an hour of staleness is nothing for historical data, and
  Cloudflare revalidates with ETags anyway.
- Security on `/*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(),
  geolocation=()`, and a CSP. The app has **zero external origins** (fonts bundled, data
  same-origin), so a near-strict CSP is cheap:
  `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src
  'self' https://static.cloudflareinsights.com; connect-src 'self'
  https://cloudflareinsights.com; base-uri 'self'; frame-ancestors 'self'`.
  (`style-src 'unsafe-inline'` is required by React inline style attributes; the two
  cloudflareinsights entries are for the analytics beacon — drop them if analytics changes.
  `frame-ancestors 'self'` blocks third-party embedding; **revisit when the embed feature
  from `commercialization-plan.md` M4 ships**.)
- HSTS: enable in the Cloudflare dashboard (Always Use HTTPS + HSTS) after the custom domain
  serves correctly for a few days.

Exact file content is specified in `implementation-roadmap.md` P1-1.

## Monitoring

| Concern | Tool | Cost | Notes |
|---|---|---|---|
| Is it up | UptimeRobot (or Cloudflare's built-in health checks) | Free | 5-min HTTPS check on conflicts.io + alert e-mail. Static site on a CDN ≈ it is basically always up; this catches DNS/cert/domain-expiry mistakes, which are the realistic failures. |
| Who visits | Cloudflare Web Analytics | Free | Cookie-less, no consent banner. Upgrade path: Plausible (~€9/mo) if referrer/goal detail is ever needed. |
| JS errors | `window.onerror`/`unhandledrejection` → lightweight visible hint + console (launch); Sentry free tier (5k events/mo) only if blind spots hurt later | Free | Sentry's SDK is ~25 KB gz — a fifth of the JS budget. Don't add it by default; the perf baselines in CLAUDE.md outrank it. |
| Perf regressions | `node tools/perf.mjs` locally (existing), optionally in CI later | Free | The existing tool is the baseline guard; CI automation is roadmap P2-6, not a launch need. |
| Domain/cert expiry | Cloudflare auto-renew + calendar reminder | — | The domain already lapsed once (see `publication-plan.md`). Turn on auto-renew and a reminder; this is the single most likely outage cause for this site. |

## Backups and disaster recovery

Current state: pushed to **github.com/LSchuster/sites** (public, branch `main`) on
2026-08-07 — the off-site copy exists (roadmap P0-1 ☑).

- **Primary backup = GitHub.** Everything needed to rebuild the site is in git, including
  `public/data/`. Recovery on any machine: clone → `npm ci` → `npm run build` → upload
  `dist/` anywhere (relative base makes any host work). RTO ≈ 30 minutes.
- **Pipeline inputs**: `data/raw/` is gitignored and re-fetchable, except the UCDP CSV
  (manual 29 MB download) and the risk that any upstream (historical-basemaps repo, Wikidata
  query results, UCDP versions) changes or disappears. Archive the raw downloads once to
  Cloudflare R2 or Backblaze B2 (both free at this size) so every shipped dataset stays
  reproducible. Roadmap P0-5.
- **Host is not a backup.** Cloudflare Pages keeps past deployments, but treat git as the
  only source of truth.

## Security

The attack surface is small and should stay that way:

- **No secrets at runtime, no server, no user data, no cookies.** Do not add any of these
  casually; each one (especially cookies/accounts) drags in consent and storage obligations
  (see `commercialization-plan.md` § Legal).
- **Supply chain is the real risk**: `package-lock.json` committed (it is), `npm ci` in CI
  (never `npm install`), enable GitHub Dependabot alerts + monthly `npm audit` habit. Vite,
  React and d3 are the only runtime deps — keep it so.
- **Account security**: 2FA on GitHub and Cloudflare. These two accounts *are* the site.
- Headers/CSP as above; `base-uri 'self'` and no inline scripts keep XSS margins wide even
  though the app renders no third-party content.
- GPL-3.0 compliance is a publishing requirement, not just a legal nicety: the public GitHub
  repo satisfies the source-offer obligation automatically. Keep the repo public (see
  `publication-plan.md`).
