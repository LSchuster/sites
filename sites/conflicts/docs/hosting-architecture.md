# Hosting architecture

Status: **plan, not yet implemented** · Written 2026-08-07 · Prices and free-tier limits were
verified on that date and drift — re-check before acting on a number.

This doc answers: where the site runs, what it costs, how deploys happen, and what keeps it
safe. Launch steps and sequencing live in `publication-plan.md`; the task breakdown an agent
can execute lives in `implementation-roadmap.md`.

**Monorepo context (added 2026-08-07):** the repo is a multi-site monorepo — each site
self-contained under `sites/<name>/`, each deployed to `<name>.teespoon.io`, one shared
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
   subdomains get free SSL — `conflicts.teespoon.io` yes, `a.b.teespoon.io` no.)

Free-plan limits that matter (verified 2026-08 against the live pricing page): 500
builds/month (1 concurrent), 20,000 files/deploy, 25 MiB/file, 100 custom domains/project,
unlimited sites/requests/bandwidth. SSL certificates are included free (Universal SSL,
auto-renewing, covers first-level subdomains) — never buy a certificate from a registrar
upsell. The repo uses ~231 files and a handful of builds per week — an order of magnitude
of headroom everywhere.

### Topology

```
GitHub monorepo (source of truth, incl. each site's committed data)
   │  push / PR, path-filtered per site
   └─▶ GitHub Actions — .github/workflows/conflicts.yml (one workflow file PER SITE)
            job "build":  cd sites/conflicts → npm ci → tsc -b + vite build
                          → data:validate → upload dist/ artifact
            job "deploy": wrangler pages deploy (Cloudflare Direct Upload)
                          — skips with a notice until the Cloudflare secrets exist
              │
   Cloudflare Pages — one project PER SITE, no Git integration, no Pages builds
            main push → production deployment · PR branch → preview URL
              │
   teespoon.io zone (Cloudflare Registrar + DNS, one registration for all sites)
     ├─ conflicts.teespoon.io  → Pages project "conflicts-atlas" (Universal SSL, HSTS)
     ├─ <next>.teespoon.io     → Pages project "<next-site>"
     └─ apex teespoon.io       → optional tiny index page listing the sites (later)
              │
   Cloudflare Web Analytics (beacon per site, cookie-less)
```

- Deploys are **Direct Uploads from CI** (chosen 2026-08-07 over Pages' Git integration):
  the whole pipeline is versioned in the repo, secrets are the only dashboard-side state,
  and Pages' 500-builds/month quota is never consumed — builds run on GitHub Actions,
  free for public repos. Path filters in each workflow replace Pages "build watch paths".
- PRs get **preview deployments** (`wrangler pages deploy --branch=<pr-branch>` → unique
  preview URL, printed in the workflow log) — screenshot review with
  `tools/shot.mjs <preview-url> …` becomes possible pre-merge.
- No `_redirects` needed: the app is a single page; permalinks use `location.hash`. Pages
  serves `index.html` for unknown paths when no `404.html` exists, which is the behaviour we
  want — do not add a `404.html`.

### One-time Cloudflare setup (human — do this after creating the Cloudflare account)

The workflow `.github/workflows/conflicts.yml` already exists and runs CI on every push;
its deploy job activates itself the moment these values are in place:

| Where | Name | Value / how to get it |
|---|---|---|
| GitHub → repo → Settings → Secrets and variables → Actions → **Secrets** | `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → *Custom token* with the single permission **Account · Cloudflare Pages · Edit**, scoped to your account. Copy once, store nowhere else. |
| same **Secrets** tab | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages overview — the Account ID in the right sidebar (also visible in the dashboard URL). |
| same page, **Variables** tab (optional) | `CLOUDFLARE_PROJECT_CONFLICTS` | Pages project name; defaults to `conflicts-atlas` (→ conflicts-atlas.pages.dev). `*.pages.dev` names are globally unique — if the first deploy fails with a name conflict, set this variable to another name and re-run. |

Then: **Actions tab → "conflicts" workflow → Run workflow** (or push anything). The deploy
job creates the Pages project itself (production branch `main`) and publishes; the site
appears at `https://<project>.pages.dev`. Node version is pinned in the workflow (22) and
in `engines` in package.json — no dashboard build settings exist at all.

After roadmap P0-2 (umbrella domain): Pages project → Custom domains → add
`conflicts.teespoon.io` (the DNS record is created automatically in the shared zone),
then enable Always-Use-HTTPS, HSTS a few days later. Every future site repeats only this
paragraph plus a sibling workflow file — the two secrets are shared account-wide.

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

One workflow per site — `.github/workflows/conflicts.yml` (exists since 2026-08-07),
triggered by push/PR path-filtered to `sites/conflicts/**` (+ the workflow file itself)
and manually via `workflow_dispatch`:

1. **build job**: Node 22 with npm cache → `npm ci` → `npm run build` (runs `tsc -b`
   first) → `npm run data:validate` → uploads `dist/` as an artifact. Runs on every push
   and PR regardless of secrets. Public repo ⇒ Actions minutes are free.
2. **deploy job** (`cloudflare/wrangler-action`): downloads the artifact and runs
   `wrangler pages deploy` — a production deployment when the ref is `main`, a preview
   deployment for PR branches. **Gated on the secrets**: until `CLOUDFLARE_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID` exist it emits a skip notice and the run stays green, so CI
   works today and deployment switches on the day the secrets are added (§ One-time
   Cloudflare setup above). It also creates the Pages project on first run.

A new site = copy the workflow file; change the paths filter, folder, and project-name
variable; the two account secrets are shared.

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
