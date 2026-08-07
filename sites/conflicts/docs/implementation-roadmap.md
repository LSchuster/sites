# Implementation roadmap

Status: **in progress — P0-1 done, everything else planned** · Written 2026-08-07 · Index doc:
`publication-plan.md`. Strategy rationale: `hosting-architecture.md`,
`commercialization-plan.md`.

Path: **Current state → Public beta (P0+P1) → Public release (P2) → Monetization (M) →
Growth (G)**.

**2026-08-07, restructure done:** the repo became a multi-site monorepo; this site now
lives in `sites/conflicts/` and will deploy to `conflicts.<umbrella>.io` under one shared
umbrella domain (`publication-plan.md` § The domain). Paths in the tasks below are
relative to `sites/conflicts/` unless they start with `sites/` or `.github/`. Run all npm
commands inside `sites/conflicts/`.

## How to work this list (rules for implementing agents)

- One task per session/PR. Tasks are ordered within a phase but independent unless
  **Depends** says otherwise. Update the checkbox and add a dated note when done.
- CLAUDE.md rules override everything here. In particular: never hand-edit `public/data/`
  (rule 1), no React in the render loop (rule 4), run the "Before you call it done" block.
- Anything touching the visible app ends with a screenshot check:
  `node tools/shot.mjs <url> out.png 4500 1500 950` — look at the image.
- **[HUMAN]** marks steps needing the owner (accounts, addresses, payments, decisions).
  Do the automatable part, then stop and list exactly what the human must do.
- File:line references were verified 2026-08-07; re-verify before editing.

Legend: `[HUMAN]` needs owner input · ⏰ time-critical.

---

## Phase 0 — Foundation (before anything is public)

### ☑ P0-1 · Push the repo to GitHub — DONE 2026-08-07
- **Outcome:** public repo **github.com/LSchuster/sites**, default branch `main`
  (renamed from `master`), local history squashed to two clean commits before first push.
  `engines: { "node": ">=22" }` added to `sites/conflicts/package.json`. Git identity set
  to the GitHub noreply address. `data/raw/` confirmed absent from the pushed tree,
  `public/data/` present.

### ☐ P0-2 · Register the umbrella domain (+ optional conflicts.io rescue ⏰) [HUMAN]
- **Goal:** One `.io` domain that all sites in the repo share as subdomains; this site at
  `conflicts.<umbrella>.io`.
- **Changes:** [HUMAN]
  1. Pick the umbrella name, check availability, register at Cloudflare Registrar
     (~$50–60/yr, at cost), **enable auto-renew** — this name lapsing would take every
     site down at once.
  2. Optional vanity rescue of `conflicts.io`: RDAP 2026-08-07 — registrar Cloudflare,
     expired 2026-06-22, in `redemption period`, drops ≈ early September 2026. If the
     lapsed registration is in our own Cloudflare account, restore costs renewal +
     ~$80–120 redemption fee. ⏰ Decide before end of August 2026; after the drop,
     backorder or forget it. If rescued: 301-redirect it to the canonical subdomain (a
     Cloudflare zone redirect rule, no hosting needed).
  3. Record both outcomes here; the chosen hostname feeds P1-2, P1-3, P1-10.
- **Depends:** nothing. Blocks only P0-4's custom-domain step — Pages' `*.pages.dev` URL
  works without it.
- **Accept:** umbrella zone live in the Cloudflare account with auto-renew on; decision on
  conflicts.io recorded in this doc; final hostname for this site written into P1-2/P1-3.

### ☐ P0-3 · CI workflow — Priority: high
- **Goal:** Every push/PR proves the build and the data invariants.
- **Changes:** create `.github/workflows/ci.yml` (repo root): trigger on `push` +
  `pull_request` with `paths: ['sites/conflicts/**']`; ubuntu-latest;
  `defaults.run.working-directory: sites/conflicts`; `actions/setup-node` with
  `node-version: 22` and npm cache keyed on `sites/conflicts/package-lock.json`;
  `npm ci` → `npm run build` (runs `tsc -b` first by definition) → `npm run data:validate`.
  No deploy step (deploys are Pages' job, P0-4). No secrets. Future sites add a sibling
  job with their own paths filter.
- **Depends:** P0-1.
- **Accept:** green check on GitHub for a trivial commit; a deliberately broken type and a
  deliberately broken YAML range each fail CI (test locally with `act` or just reason it
  through and verify the green path).

### ☐ P0-4 · Cloudflare Pages project — Priority: high [HUMAN]
- **Goal:** The site live on the internet with previews per branch.
- **Changes:** [HUMAN] create Cloudflare account (2FA), Pages project via Git integration
  → repo from P0-1. Settings (full table in `hosting-architecture.md`): **root directory
  `sites/conflicts`**, build `npm run build`, output `dist`, **build watch paths
  `sites/conflicts/*`**, env `NODE_VERSION=22`, production branch `main`. When P0-2
  resolves: attach custom domain `conflicts.<umbrella>.io`, then enable Always-Use-HTTPS;
  enable HSTS a few days later. Turn on Cloudflare Web Analytics readiness (token used in
  P1-6).
- **Depends:** P0-1. Custom-domain step depends on P0-2.
- **Accept:** `node tools/shot.mjs https://<project>.pages.dev out.png 6000 1500 950`
  produces a screenshot with the map visibly rendered (not the loading rings); a PR branch
  gets a preview URL.

### ☐ P0-5 · Archive raw pipeline inputs — Priority: medium [HUMAN]
- **Goal:** Every shipped dataset stays reproducible even if upstream vanishes.
- **Changes:** [HUMAN] create Cloudflare R2 bucket (free at this size) or Backblaze B2;
  upload `ged251-csv.zip` (29 MB) and a snapshot of the historical-basemaps GeoJSON inputs;
  note bucket + retrieval steps in `docs/data.md` (short "Raw-input archive" subsection).
- **Depends:** P0-4 (same Cloudflare account) — or do standalone with B2.
- **Accept:** `docs/data.md` names the archive location; files verified downloadable.

---

## Phase 1 — Public beta gates (all must-have before announcing anything)

### ☐ P1-1 · `public/_headers` — caching + security — Priority: high
- **Goal:** Immutable caching for hashed assets, sane caching for data, security headers,
  near-strict CSP. (Vite copies `public/` verbatim into `dist/`.)
- **Changes:** create `public/_headers` exactly per `hosting-architecture.md` § Caching:
  `/*` → nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy
  denying camera/mic/geo, CSP (`default-src 'self'`; `img-src 'self' data:`; `style-src
  'self' 'unsafe-inline'`; `script-src 'self' https://static.cloudflareinsights.com`;
  `connect-src 'self' https://cloudflareinsights.com`; `base-uri 'self'`;
  `frame-ancestors 'self'`); `/assets/*` → `max-age=31536000, immutable`; `/data/*` →
  `max-age=3600, stale-while-revalidate=86400`.
- **Depends:** P0-4 (verification needs a deployed URL).
- **Accept:** on the deployed URL: `curl -sI <url>/` shows the security headers;
  `curl -sI <url>/data/conflicts.json` shows the data cache policy; the app renders with
  **zero CSP violations** in the console (check via shot.mjs run + CDP console dump or
  manual devtools); the grain texture (`src/map/grain.ts`, data: URL) still renders.

### ☐ P1-2 · Head metadata, favicon, OG image, noscript — Priority: high
- **Goal:** Links unfurl properly; no favicon 404; crawlers without JS see one honest
  paragraph.
- **Changes:**
  1. `index.html`: add `og:title`, `og:description`, `og:type=website`,
     `og:url=https://conflicts.<umbrella>.io/` (final hostname from P0-2), `og:image` +
     `twitter:card=summary_large_image` pointing at `/og.png`; `theme-color` (`#0b0e13` —
     confirm against the app background in `src/styles.css`); `<link rel="canonical">`;
     favicon links; `<noscript>` with the one-paragraph site description (reuse the meta
     description text).
  2. Create `public/og.png` (1200×630): screenshot a dramatic composed view —
     `node tools/shot.mjs http://localhost:5173/ og-raw.png 5000 1200 630` at a chosen year
     (1942 or 755); crop/letterbox to exactly 1200×630. Keep under ~300 KB.
  3. Create `public/favicon.ico` (32px) + `public/icon.svg` + `public/apple-touch-icon.png`
     (180px). Design: minimal mark on dark — e.g. the site's casualty-circle motif (ring
     with soft fill) in the existing palette; no text.
- **Depends:** P0-4 for final URL values; can be built before.
- **Accept:** `dist/index.html` contains all tags; opengraph.xyz / a manual scraper fetch
  shows title+image; browser tab shows the icon; `/favicon.ico` returns 200; disabling JS
  shows the noscript paragraph.

### ☐ P1-3 · robots.txt + sitemap.xml — Priority: medium
- **Goal:** Crawlability signals; nothing to hide.
- **Changes:** `public/robots.txt` (`User-agent: *` / `Allow: /` / `Sitemap:` line);
  `public/sitemap.xml` with the single root URL (add legal pages from P1-4 when they exist).
  Use the final hostname from P0-2 (`conflicts.<umbrella>.io`); placeholder until then.
- **Depends:** P1-4 ideally done first (to include its URLs) — or update after.
- **Accept:** both files served with 200 on the deployed URL; sitemap parses (any validator).

### ☐ P1-4 · Impressum + Datenschutzerklärung — Priority: high (legal gate) [HUMAN]
- **Goal:** §5 DDG + Art. 13 GDPR compliance for a German operator, without adding cookies
  or consent UI.
- **Changes:**
  1. Create `public/impressum.html` and `public/datenschutz.html` as small static pages
     (stable URLs matter for legal pages; avoids touching the SPA). Minimal inline CSS
     matching the dark theme; German primary, short English summary section below.
  2. Content: Impressum with [HUMAN] name, ladungsfähige address, e-mail (no phone needed
     — e-mail satisfies the fast-contact requirement per ECJ case law; a P.O. box does NOT
     satisfy the address requirement). **Address-privacy options** [HUMAN decision]: (a)
     home address + `noindex` on the legal pages (no duty to be indexed) + light
     obfuscation against scrapers — the common solo-operator default; (b) rented
     ladungsfähige Anschrift via an Impressum-service (~€10–30/mo — note this would be the
     largest cost in the stack; choose a provider that genuinely accepts service of legal
     documents). Duty trigger reminder: gray zone while unannounced on `*.pages.dev`,
     required from public launch, unambiguous once donations/affiliate/sales exist.
     Datenschutzerklärung covering:
     static hosting via Cloudflare (server logs/DPA), cookie-less analytics (added in P1-6
     — write the section now, it ships together), locale in localStorage (no personal
     data), no accounts, no tracking, outbound links. Keep to one screen. [HUMAN] should
     eyeball against a current generator (e-recht24 or similar) before launch.
  3. Link both pages from the About panel (`src/ui/About.tsx`) and add a small fixed footer
     link or masthead entry — i18n strings in `src/i18n/locales/en.ts` + `de.ts` (typed via
     `src/i18n/types.ts`, so tsc enforces both).
- **Depends:** P1-6 decision (analytics tool named in the privacy text). [HUMAN] for
  personal data.
- **Accept:** both URLs return 200 on the deploy; links reachable from the UI in both
  locales; `npx tsc --noEmit` clean; pages readable on a 390px viewport.

### ☐ P1-5 · About panel: licence + attribution completeness — Priority: high
- **Goal:** Close the attribution gaps and make the project citable.
- **Changes:** in `src/i18n/locales/en.ts` + `de.ts` (About sources section, en.ts:140-179;
  extend `src/i18n/types.ts` / `src/ui/About.tsx` if new keys/sections are needed):
  1. Add **Natural Earth** credit for the terrain relief (`public/data/terrain/relief.webp`
     — currently uncredited).
  2. Add **EB Garamond / SIL OFL 1.1** credit (licence text already ships at
     `src/assets/fonts/OFL.txt`; link or mention it).
  3. Add a proper licence line: "Code and data: GPL-3.0-or-later — source on GitHub" with
     the repo URL from P0-1 (GPL is currently only mentioned in passing at en.ts:164).
  4. Add a one-line "Cite this atlas as: …" blurb (site name, URL, retrieval year).
- **Depends:** P0-1 (repo URL).
- **Accept:** `npx tsc --noEmit` clean (proves both locales updated); About panel
  screenshot in both languages shows the four additions.

### ☐ P1-6 · Analytics (cookie-less) + truth-fix the About copy — Priority: high [HUMAN]
- **Goal:** Know whether anyone visits, without cookies, consent UI, or breaking the
  privacy promise.
- **Changes:**
  1. [HUMAN] In Cloudflare dashboard: enable Web Analytics for the site, get the beacon
     token.
  2. Add the beacon `<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
     data-cf-beacon='{"token": "…"}'>` to `index.html`. (CSP from P1-1 already allows it.)
  3. Reword `en.ts:103` and the German counterpart: from "nothing you do here is recorded"
     to "no account, no cookies — only anonymous, aggregate visit counting". Same change in
     the P1-4 privacy page if already written.
- **Depends:** P0-4; coordinates with P1-1 (CSP) and P1-4 (privacy text).
- **Accept:** on the deployed site: beacon request visible in the network tab and **no
  cookies set** (`document.cookie` is empty); dashboard shows the visit; both locales'
  About text updated; no CSP violation.

### ☐ P1-7 · Fetch-failure UI — Priority: high
- **Goal:** A failed core fetch (conflicts.json, border index) must show an error + reload,
  not today's infinite spinner.
- **Changes:** core loads are fired-and-forgotten at `src/map/MapCanvas.tsx:157`
  (`void initConflicts()`) and `:146` (`void initBorders().then(...)`); `src/ui/Loading.tsx`
  only knows `is-done`. Add a `loadError` flag to `src/state/store.ts`; `.catch` the two
  core loads to set it; `Loading.tsx` renders a short message + reload button when set
  (strings in both locales via `types.ts`). Do **not** touch the optional-asset silent
  degradation (`ged.ts:52`, `terrain.ts:44`, `flags.ts:24` — correct as is), and keep the
  store write outside any per-frame path.
- **Depends:** nothing.
- **Accept:** with devtools blocking `conflicts.json`, the message + working reload button
  appears; normal load unchanged; `node tools/perf.mjs` numbers unchanged; tsc clean.

### ☐ P1-8 · Mobile: restore the viz-mode toggle under 860px — Priority: high
- **Goal:** Phones can switch absolute ↔ population view — the app's core analytic control,
  currently unreachable because the whole legend is hidden.
- **Changes:** the toggle lives inside `.legend` (`src/map/Legend.tsx:63-73`), which
  `src/styles.css:846` sets `display: none` under 860px. Either split the toggle out of
  `.legend` into its own element that survives small screens (preferred), or re-show a
  compacted legend variant. Place it clear of the timeline and the bottom-sheet panel
  (`styles.css:838`). Leave `.tools__types` (`:1181`) and `.timeline__speeds` (`:1355`)
  hidden — explicitly out of scope. Consider `env(safe-area-inset-bottom)` padding for the
  chosen position.
- **Depends:** nothing.
- **Accept:** `node tools/shot.mjs http://localhost:5173/ mobile.png 4500 390 844` shows
  the toggle visible and not overlapping timeline/panel; tapping it switches modes
  (shot.mjs click coords); desktop layout unchanged at 1500×950.

### ☐ P1-9 · Feedback channel — Priority: medium
- **Goal:** A visitor who found a wrong number can tell us in one click.
- **Changes:** About panel (+ footer if P1-4 added one): "Corrections & feedback" line with
  GitHub Issues URL and the contact e-mail (same as Impressum). Strings in both locales.
- **Depends:** P0-1 (issues URL), P1-4 (address).
- **Accept:** links present and working in both locales; tsc clean.

### ☐ P1-10 · Align product name with the chosen hostname — Priority: medium
- **Goal:** The app stops claiming a domain it may not live on. It is currently titled
  "conflicts.io" (`index.html:6`, About panel lede, README heading) but will serve from
  `conflicts.<umbrella>.io`.
- **Changes:** per the P0-2 decision — **if umbrella-only** (conflicts.io not rescued):
  rename user-facing strings to a hostname-neutral name (e.g. "Conflicts — An Atlas of
  Human Conflict") in `index.html` title/meta/OG, `src/i18n/locales/en.ts` + `de.ts`
  (About + any masthead strings; typed catalogs make tsc find them), `README.md` heading,
  and the P1-5 cite-this blurb. **If rescued:** keep the name, verify the 301 redirect
  conflicts.io → canonical subdomain, and set `<link rel="canonical">`/`og:url` to the
  canonical host only.
- **Depends:** P0-2; touches the same strings as P1-2/P1-5 — do after those or in the same
  pass.
- **Accept:** no user-visible string names a domain the site does not control; tsc clean;
  screenshot of masthead + About in both locales.

---

## Phase 2 — Public release (should-have shortly after beta)

### ☐ P2-1 · Shareable permalinks (hash state) — Priority: high (the release feature)
- **Goal:** Every share deep-links: `#y=1942&c=world-war-ii&v=share`. Currently zero URL
  state exists (nothing in `src/` touches `location`).
- **Changes:** new `src/state/url.ts`: parse hash on boot → seed `src/state/store.ts`
  (year float, selected conflict id, viz mode); write back with `history.replaceState`
  **only on interaction end / playback pause** — never per frame (CLAUDE.md rule 4; the
  year is fractional, rule 2 — serialize rounded to 0.1, parse as float). Ignore invalid
  values silently. Selected-conflict id must survive the data load race (apply after
  conflicts load).
- **Depends:** P1-* none strictly; ship before launch posts (P2-3).
- **Accept:** setting a hash URL and reloading restores year/selection/mode; scrubbing then
  pausing updates the hash once; `node tools/perf.mjs` unchanged on all four states;
  invalid hash → default view, no error.

### ☐ P2-2 · Compress the GED `.bin` transfer — Priority: medium
- **Goal:** The five GED decade files are ~1 MB raw and, as `application/octet-stream`,
  CDNs will not compress them — sessions crossing 1989 pull ~1 MB that should be ~271 KB.
- **Changes:** preferred: pipeline pre-compresses (gzip via `fflate`, already a devDep, in
  `pipeline/4-ucdp-aggregate.ts`) → `src/data/ged.ts:46` wraps the fetch body in native
  `DecompressionStream('gzip')`. Alternative (no code): `_headers` `Content-Type` override
  — rejected, brittle. Regenerate `public/data/ged/`, commit.
- **Depends:** P1-1 (headers file exists; add `Content-Encoding`-related lines only if the
  chosen approach needs them — it should not).
- **Accept:** deployed network tab shows ged transfers totalling ≈271 KB; year 1989–2020
  playback renders identically (screenshot compare vs before); `npm run data:validate`
  green; CLAUDE.md baseline table updated if numbers moved.

### ☐ P2-3 · Launch content kit — Priority: medium [HUMAN]
- **Goal:** Ready-to-post launch material so the announcement is a decision, not a project.
- **Changes:** `docs/launch-kit.md` (gitignored is fine too — owner's call): Show HN draft
  (technical angle: static atlas, 60 fps canvas, uncertainty rendering), r/dataisbeautiful +
  r/MapPorn drafts, 4–6 screenshots via `tools/shot.mjs` at years 117 / 755 / 1815 / 1942 /
  2022, submission list (Flowing Data, Data Is Plural). [HUMAN] posts them, following the
  sequenced waves in `marketing-plan.md` § Launch playbook (English wave → image wave →
  German wave).
- **Depends:** P2-1 (links in posts should deep-link), P1-2 (unfurls).
- **Accept:** kit exists with drafts + rendered screenshots; owner has a checklist.

### ☐ P2-4 · Data-refresh runbook — Priority: medium
- **Goal:** The annual UCDP bump (~June/July, vN.1) is a documented 30-minute procedure.
- **Changes:** append a "Refreshing UCDP" section to `docs/data.md`: new zip URL pattern,
  where the version string lives in `pipeline/4-ucdp-aggregate.ts`, run order
  (`data:ucdp` → `data:validate`), expected size drift, CLAUDE.md baseline-table update,
  archive the new zip (P0-5 bucket).
- **Depends:** P0-5.
- **Accept:** section exists; a cold-start agent could execute it without other context.

### ☐ P2-5 · CI screenshot smoke test — Priority: low (optional)
- **Goal:** CI catches a blank-canvas regression (the failure mode `tools/shot.mjs` exists
  for).
- **Changes:** extend `ci.yml`: build, `npx serve dist`, run `tools/shot.mjs` against
  localhost — the tool drives Edge via CDP; on ubuntu runners point it at installed Chrome
  (make the browser binary path an env/arg in `shot.mjs` if hardcoded), assert the output
  PNG is non-trivial (>50 KB and not a single flat colour), upload as artifact.
- **Depends:** P0-3.
- **Accept:** CI run shows the artifact; deliberately serving an empty dir fails the check.

### ☐ P2-6 · Touch hover affordances — Priority: low (optional)
- **Goal:** On `(hover: none)` devices, hover-only information (tooltip, country card) has
  a tap path.
- **Changes:** review `src/map/MapCanvas.tsx:95-133` pointer handling; on coarse pointers
  let tap-on-country show the country card (currently hover-driven), second tap or ✕ to
  dismiss. Add `(hover: none)` media queries where affordances assume a cursor.
- **Depends:** P1-8.
- **Accept:** on a 390px touch emulation, tapping a country shows its card; desktop hover
  behaviour unchanged; perf.mjs hover sweep unchanged.

---

## Phase MK — Marketing (runs alongside P2 and M; strategy in marketing-plan.md)

Mostly [HUMAN] content/outreach work with small technical assists; kept brief here — the
channel reasoning, sequencing, and taste rules live in `marketing-plan.md`.

### ☐ MK-1 · Press kit — Priority: high (blocks the video channel)
- **Goal:** One page/folder that makes covering or reusing the atlas effortless.
- **Changes:** `docs/press/` (or a static `press.html` like the P1-4 pages): 5–6 curated
  screenshots (`tools/shot.mjs` at years 117 / 755 / 1815 / 1942 / 2022), boilerplate
  description (EN+DE), the licence/attribution line, and — once MK-3 exists — downloadable
  timelapse clips marked "free to use with attribution".
- **Depends:** P1-2 (favicon/OG assets double as kit assets).
- **Accept:** a journalist or video creator can get image, clip, description, and
  attribution rules in one place without emailing.

### ☐ MK-2 · Social accounts + weekly cadence — Priority: medium [HUMAN]
- **Goal:** A living Bluesky/Mastodon presence before the launch waves need it.
- **Changes:** [HUMAN] create accounts; establish the weekly "year spotlight" routine
  (screenshot + two sentences + P2-1 deep link). Optional technical assist: a small script
  listing curated conflicts by calendar month (from `conflicts.json` dates) to feed the
  anniversary calendar.
- **Depends:** P2-1 (deep links). **Accept:** 4 consecutive weekly posts published.

### ☐ MK-3 · Border-timelapse video clips — Priority: high (highest-ceiling channel) [HUMAN]
- **Goal:** 3–5 short clips ("2,000 years in 60 seconds"; Europe-only; China-only; the
  20th century) for Shorts/TikTok/Reels and the MK-1 press kit.
- **Changes:** [HUMAN] OBS screen-capture of playback at 1080×1920 crop or 4K; site URL
  visible in-frame (watermark or end card). Post to own channels; add to press kit with
  the reuse invitation.
- **Depends:** MK-1 for distribution; none technically.
- **Accept:** clips uploaded and downloadable; at least one posted natively per platform.

### ☐ MK-4 · Launch waves — Priority: high, one focused week [HUMAN]
- **Goal:** Execute `marketing-plan.md` § Launch playbook: Show HN →
  r/InternetIsBeautiful → newsletters → r/dataisbeautiful [OC] → r/MapPorn → German wave
  (r/de, Piqd, German data-desk pitches).
- **Depends:** P1-* complete, P2-1, P2-3 kit, MK-1.
- **Accept:** each wave posted per the sequencing; referrer spikes visible in analytics;
  learnings noted in `marketing-plan.md`.

### ☐ MK-5 · Seasonal entries: #30DayMapChallenge + IIB Awards — Priority: medium [HUMAN]
- **Goal:** The cartography community's November event (~10 of the 30 prompts served from
  atlas frames) and an Information is Beautiful Awards entry.
- **Depends:** MK-2 accounts. **Accept:** posts published in November 2026; awards entry
  submitted in the current cycle (verify both still run as described).

### ☐ MK-6 · Education link-list submissions — Priority: low, background [HUMAN]
- **Goal:** Durable backlinks + the honest route into classrooms (feeds M4).
- **Changes:** [HUMAN] submit to German educational link collections (Landesbildungsserver
  Linktipps, history-teacher portals) and English equivalents; track submissions in a list.
- **Depends:** P1-4 (legal pages — edu portals check), P1-5 (citability).
- **Accept:** ≥5 submissions sent; accepted listings recorded.

---

## Phase M — Monetization (order is the strategy; see commercialization-plan.md)

### ☐ M1-1 · Donation links — Priority: high, ship with/just after public release [HUMAN]
- **Goal:** A tip jar exists before any viral moment.
- **Changes:** [HUMAN] create Ko-fi (and/or GitHub Sponsors on the P0-1 repo). Add a
  "Support the atlas" section to About + a small masthead/footer link — plain `<a>`, no
  third-party script/widget (CSP stays closed). Both locales via typed catalogs.
- **Depends:** P0-1; P1-4 (Impressum exists before money is mentioned).
- **Accept:** links work in both locales; no new network origins (CSP unchanged); tsc clean.

### ☐ M2-1 · `reading:` field — schema, compile, validate — Priority: medium
- **Goal:** Curated further-reading lives in the data layer like everything else.
- **Changes:** optional `reading:` list on conflicts in `data/curated/*.yaml` (`title`,
  `author`, `year`, `url`, optional `note`); pass through in
  `pipeline/6-compile-conflicts.ts` (incl. i18n fallback rules — titles stay original
  language, `note` translatable via `data/curated/i18n/de.yaml`); checks in
  `pipeline/7-validate.ts` (required subfields, https URLs, warn >5 entries). Populate 2–3
  conflicts as fixtures (plain publisher/Wikipedia URLs — affiliate tags come in M2-3).
- **Depends:** none (pure data-layer).
- **Accept:** `npm run data:conflicts && npm run data:validate` green; `conflicts.json`
  carries `reading` for the fixtures; a deliberately broken entry fails validation.

### ☐ M2-2 · Reading-shelf UI + disclosure — Priority: medium
- **Goal:** The conflict panel shows further reading, honestly labelled.
- **Changes:** new section in `src/panel/` conflict detail: renders only when `reading`
  present; one line per book; disclosure string ("Contains affiliate links / Enthält
  Werbe-Links" — exact wording per §5a UWG) shown only when any URL is tagged as affiliate
  (add a boolean or detect the tag param). Strings in both locales.
- **Depends:** M2-1.
- **Accept:** shelf renders for fixture conflicts, absent otherwise; disclosure logic
  correct for tagged vs untagged links; tsc clean; screenshot both locales.

### ☐ M2-3 · Affiliate enrollment + populate — Priority: medium [HUMAN]
- **Goal:** The shelves earn.
- **Changes:** [HUMAN] Gewerbeanmeldung + Steuerberater consult (see
  commercialization-plan § Legal) → Amazon PartnerNet (DE) application → add tagged URLs to
  the 15–20 most-viewed conflicts (per P1-6 analytics) in the curated YAML → re-run
  pipeline. Update the P1-4 privacy page's outbound-links sentence if needed.
- **Depends:** M2-1, M2-2, P1-6 (to know which conflicts), [HUMAN] approvals.
- **Accept:** tagged links live; disclosure visible; pipeline + validate green.

### ☐ M3-1 · High-res PNG export (free) — Priority: medium, largest build in the plan
- **Goal:** "Download this view" at poster resolution, attribution baked in.
- **Changes:** offscreen export path reusing `src/map/renderer.ts` layer functions at 4–6×
  scale (one-shot render, not the rAF loop; React stays out per CLAUDE.md rule 4); render
  an attribution footer strip (UCDP CC BY 4.0, basemaps GPL credit, site URL — required,
  see commercialization-plan § Legal); trigger `canvas.toBlob` → download. Canvas is
  currently untainted (all assets same-origin; `src/map/grain.ts` already calls
  `toDataURL`) — keep it so: no cross-origin images in the export path. UI: small export
  button (both locales).
- **Depends:** none technically; sequence after traffic proof per commercialization plan.
- **Accept:** exported PNG ≥5000 px wide matches the on-screen view (fonts, labels, grain);
  attribution strip present; export of year 1942 completes <15 s on a mid laptop; the live
  view's perf.mjs numbers unchanged after the feature (export must not permanently allocate).

### ☐ M3-2 · Poster shop (digital-first, merchant-of-record) — Priority: low until M3-1 +
traffic [HUMAN]
- **Goal:** Sell 5–10 print-mastered posters without adding servers, accounts, or VAT
  handling.
- **Changes:** [HUMAN] choose MoR (Paddle / Lemon Squeezy), create products; produce poster
  masters (M3-1 renderer at print DPI, typographic pass); add a static `posters.html` (like
  the P1-4 pages) or an About section linking out to the MoR checkout; OG image per poster.
  Physical print-on-demand (Gelato/Printful) only after digital sells.
- **Depends:** M3-1; [HUMAN] accounts; commercialization-plan legal checklist done.
- **Accept:** test purchase delivers the file; shop page passes the P1-1 CSP (links out,
  no embedded checkout scripts); privacy page mentions the MoR.

### ☐ M4-1 · Embed mode — deferred, build only on inbound demand
- **Goal (when triggered):** Newsrooms/teachers embed a configured view.
- **Sketch:** `?embed=1` chrome-less variant honouring the P2-1 hash params; `_headers`
  gains a relaxed `frame-ancestors` for the embed path; a one-page "how to embed" doc.
  Do not build speculatively — revisit when an actual request arrives.

---

## Phase G — Growth (later improvements, unordered)

- **G-1 · Third locale** (fr or es): the typed-catalog system makes this mechanical —
  `src/i18n/locales/<code>.ts` + `LOCALES` registration + `data/curated/i18n/<code>.yaml`;
  tsc enforces completeness. Pick based on analytics geography.
- **G-2 · Guided tours / story mode:** scripted year+viewport+narration sequences (e.g.
  "the Mongol century") — the strongest candidate for a genuinely new product surface, and
  shareable via P2-1 permalinks.
- **G-3 · Per-conflict prerendered pages:** build-time static HTML per conflict from
  `conflicts.json` (105 indexable, cited pages linking into the atlas) — the honest
  long-tail SEO play. Real build-tooling work. **Priority raised 2026-08-07** (see
  `marketing-plan.md` § SEO): treat as the first post-release growth project after
  M1/M2 — it is the main lever on baseline daily traffic and multiplies the M2 shelves.
- **G-4 · CONTRIBUTING.md + data-contribution guide:** turn corrections into PRs — the
  YAML-with-comments format (`docs/data.md`) is already contributor-friendly.
- **G-5 · Newsletter link** (Buttondown or similar) for release notes / new-conflict
  announcements — outbound link only, keeps the no-cookie stance.
- **G-6 · Coverage expansion:** more curated conflicts in sparse centuries (the validator
  and `partOf` rules make this safe); more curated WWII-era border snapshots.

---

## Dependency picture

```
P0-1 ──► P0-3 ──► P2-5
  │  └──► P0-4 ──► P1-1 ──► P2-2        P0-2 [HUMAN] (feeds P0-4 domain step,
  │         │        └────► P1-6 ──► M2-3        P1-2/P1-3 hostnames, and P1-10;
  │         └──► P0-5 ──► P2-4                   ⏰ only its optional conflicts.io
  ├──► P1-5   ├──► P1-4 ──► P1-9, M1-1           rescue expires ≈ end of Aug 2026)
  │           └──► P1-2, P1-3
  P0-2 ──► P1-10             P2-1 ──► P2-3   M2-1 ──► M2-2 ──► M2-3
  P1-7, P1-8 (independent)   P1-8 ──► P2-6   M3-1 ──► M3-2
```

Suggested working order: **P0-1 → P0-2[HUMAN] → P0-3 → P0-4 → P1-7 → P1-2 → P1-1 → P1-4 →
P1-6 → P1-5 → P1-10 → P1-8 → P1-9 → P1-3 → (beta) → P2-1 → P2-2 → P2-3 → (release) →
M1-1 → …**
