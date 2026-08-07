# Publication plan

Status: **plan, not yet implemented** · Written 2026-08-07. This is the index of the four
"ops & product" docs:

| Doc | Answers |
|---|---|
| `publication-plan.md` (this file) | What stands between the repo and a public site; domain; legal; SEO; launch sequence |
| `hosting-architecture.md` | Where it runs, costs, CI/CD, headers, monitoring, backups, security |
| `commercialization-plan.md` | Which monetization models fit, which don't, in what order |
| `implementation-roadmap.md` | The task list (P0-*, P1-*, P2-*, M*, G-*) an agent can execute one by one |

Facts below were verified against the codebase on 2026-08-07 (file:line refs included) — an
agent picking this up later should spot-check any it depends on.

**Monorepo context (added 2026-08-07):** the repo hosts multiple independent static sites;
this one lives in `sites/conflicts/` and will be served from a **subdomain of one shared
umbrella `.io` domain** (see § The domain). Paths in these docs are relative to
`sites/conflicts/` unless they start with `sites/` or `.github/`.

---

## Where the project stands

The product is finished enough to show: 105 curated conflicts, 6.5k battles, morphing borders
over two millennia, full EN + DE localization including the About panel, 60 fps rendering with
a maintained perf harness (`tools/perf.mjs`, `tools/shot.mjs`). What is missing is entirely
*around* the product, not in it:

| Area | State (verified) |
|---|---|
| Git remote / off-site copy | ☑ Done 2026-08-07 — public repo github.com/LSchuster/sites, branch `main` |
| CI, deploy config | None (`.github/workflows/`, `_headers`, `netlify.toml` etc. all absent) |
| Domain | Strategy: subdomain of a shared umbrella `.io` domain, not yet registered. The name conflicts.io itself: **registered June 2025 via Cloudflare, expired 2026-06-22, now in redemption** (RDAP, 2026-08-07) — rescuing it is optional, see below |
| Favicon | None — every visit 404s on `/favicon.ico` |
| Social/SEO tags | None (no OG, no Twitter card, no canonical, no robots.txt, no sitemap) |
| Impressum / privacy page | None (grep: no match in `src/`) |
| Attribution | Good sources list in About (`src/i18n/locales/en.ts:140-179`), but no licence section, no repo link; Natural Earth terrain and EB Garamond uncredited |
| Analytics | None at all — currently consent-banner-free, keep it that way |
| Share links | **None — no URL state whatsoever** (`src/state/store.ts` singleton; nothing reads/writes `location`) |
| Mobile | Pan/pinch/tap/scrub all work; but `<860px` CSS hides the legend incl. the absolute/population toggle (`src/styles.css:846`), type filters (`:1181`), speed control (`:1355`) |
| Failure behaviour | A failed `conflicts.json`/borders fetch = infinite loading spinner, no message, no retry (`src/ui/Loading.tsx`, `void initConflicts()` in `src/map/MapCanvas.tsx:157`) |

Conclusion: **no product work is required to launch.** The launch work is repo hosting, one
DNS decision, ~10 small tasks, and two legal pages.

## The domain — umbrella strategy, one human decision

**Decision (owner, 2026-08-07): many small sites will share ONE umbrella `.io` domain,
each site on its own first-level subdomain.** This site will live at
`conflicts.<umbrella>.io`. Why it works: subdomains are free and unlimited in a DNS zone
you own; Cloudflare's free Universal SSL automatically covers first-level subdomains
(never nest deeper — `a.b.<umbrella>.io` needs a paid certificate); each site is its own
Cloudflare Pages project bound to its subdomain. Total domain cost for *all* sites:
one .io registration, ~$50–60/yr.

What remains to decide ([HUMAN], roadmap P0-2):

1. **Pick and register the umbrella name** (check availability; Cloudflare Registrar sells
   .io at cost). It becomes the shared brand suffix of every site, so choose something
   neutral and short.
2. **Optional — rescue `conflicts.io` itself.** RDAP 2026-08-07: registrar Cloudflare,
   registered 2025-06-22, **expired 2026-06-22, in redemption** (entered ~2026-08-01);
   drops to the open market ≈ early September 2026, where drop-catchers act in seconds.
   If the lapsed registration was our own Cloudflare account, restoring costs the ~$50
   renewal + ~$80–120 redemption fee — **worth it only as a brand/vanity purchase now**,
   since the umbrella model doesn't need it (it can simply redirect to the subdomain).
   ⏰ If wanted, act before end of August 2026; afterwards the option is gone.
3. **Align the product name** with the outcome: the app is titled "conflicts.io"
   (`index.html:6`, About panel, README). Umbrella-only ⇒ rename to something
   hostname-neutral ("Conflicts — An Atlas of Human Conflict"); rescue ⇒ keep the name and
   redirect conflicts.io → the canonical subdomain (or serve it there directly). Small
   string task either way (roadmap P1-10).

Everything else in this plan is domain-agnostic; hosting can go live on the free
`*.pages.dev` URL immediately and the custom subdomain attaches later (roadmap P0-2, P0-4).

## Launch gates (what "public beta" requires)

Ordered; IDs refer to `implementation-roadmap.md`.

1. **P0-1 — Push to GitHub, public.** ☑ Done 2026-08-07 (github.com/LSchuster/sites) —
   off-site backup, free CI substrate, and GPL §6 source-offer satisfied in one move.
2. **P0-3/P0-4 — CI + Cloudflare Pages.** After this, every push deploys; the site is live
   on `conflicts-io.pages.dev` even while the domain question resolves.
3. **P1-2/P1-3 — Head metadata, favicon, OG image, robots, sitemap.** A link shared on
   social currently unfurls as bare text. The OG image can be produced with the existing
   screenshot tool (`tools/shot.mjs`) — pick a dramatic year (1942), 1200×630.
4. **P1-4 — Impressum + Datenschutzerklärung.** Required for a German operator (§5 DDG /
   Art. 13 GDPR) — the site ships a German locale, the operator is in Germany, and
   monetization is planned, which removes any "purely personal" exemption argument. Needs
   the operator's name/address (human input). Keep the site cookie-less so the privacy page
   stays one screen long and no consent banner is ever needed.
5. **P1-5 — Licence & attribution completeness.** UCDP's CC BY 4.0 requires visible
   attribution (already present); add the missing Natural Earth + EB Garamond credits, a
   proper "GPL-3.0 — source on GitHub" line, and a "how to cite this atlas" blurb (teachers
   and Wikipedia editors are a distribution channel, make citing easy).
6. **P1-6 — Analytics.** Cloudflare Web Analytics beacon: cookie-less, so the About panel's
   "nothing you do here is recorded" (`en.ts:103`) needs only a soft rewrite ("no account,
   no cookies; anonymous, aggregate traffic counting only") in both locales — do them
   together, the sentence must never be false.
7. **P1-7 — Fetch-failure UI.** The infinite spinner on a failed core fetch is the worst
   possible first impression on a flaky connection; a one-line error + reload button in
   `Loading.tsx` suffices for launch.
8. **P1-8 — Mobile decision.** Gestures already work; the missing pieces are the three
   control clusters hidden under 860px. Minimum bar for beta: restore the
   absolute/population toggle on small screens (it is the app's core analytic control);
   filters and speed can stay desktop-only for now.
9. **P1-9 — Feedback channel.** GitHub Issues link + a contact address in the About panel
   (the Impressum forces publishing an address anyway — reuse it).

That is the complete gate list. **Explicitly not launch-blocking:** permalinks (P2-1),
compressed `.bin` transfer (P2-2), print styles, PWA/offline, more locales, any monetization.

## SEO & discoverability for a canvas SPA

Be realistic: a single-URL canvas app will never win text search; it wins by being *shared*.
Priorities in that order:

1. **Unfurl beautifully** (P1-2): OG/Twitter tags + a striking OG image. This is 90% of the
   SEO work for this site, because distribution is Reddit/HN/Mastodon/newsletters, not Google.
2. **One perfect landing page for crawlers**: static `<title>`/description already exist and
   are runtime-localized (`src/i18n/index.ts:48-56` — crawlers see English; fine). Add
   `<noscript>` fallback paragraph (currently a JS-less scraper sees an empty `<body>`),
   canonical URL, and JSON-LD (`WebSite` + `Dataset` schema — the dataset angle can surface
   in Google Dataset Search, which historians actually use).
3. **Permalinks** (P2-1, post-beta): `#year=1942&conflict=world-war-ii` hash state so shares
   deep-link. This multiplies share value but is not a gate.
4. **Long-tail content later** (G phase): if growth is ever pursued seriously, per-conflict
   static pages (pre-rendered from `conflicts.json` at build time) are the honest SEO play —
   105 indexable pages of curated, cited content. Significant work; explicitly deferred.

## Launch sequence

1. **Silent beta (target: within ~2 weeks of starting work)** — P0 done, site on
   `*.pages.dev` behind no announcement. Ask 5–10 people (mixed: one historian, one teacher,
   phones and laptops) to break it. Fix what they hit.
2. **Public beta** — P1 gates done, domain resolved (or fallback name adopted). Soft
   announce: personal networks, r/dataisbeautiful with an honest "I built this" post,
   Mastodon data-viz crowd. Watch Cloudflare Analytics + feedback channel.
3. **Public release (v1.0)** — P2-1 permalinks shipped (shares deep-link), P2-3 launch kit:
   Hacker News "Show HN" (weekday morning US time), r/MapPorn, r/history, r/dataisbeautiful
   (different week than beta post), data-viz newsletters (Flowing Data, Data Is Plural —
   both take submissions). Have the About panel's methodology story ready — HN will ask
   about double counting and source bias within the first hour; the answers already exist
   in the About panel, link to them.
4. **Post-launch cadence** — annual UCDP refresh (P2-4 runbook, ~July each year when GED
   vN.1 drops), curated-conflict additions as interest dictates, monetization only after
   traffic exists (see `commercialization-plan.md` § Sequencing).

## Risks worth naming

- **Losing the conflicts.io rescue option** (deadline ≈ end of August 2026): only matters
  if the owner wants the vanity name; the umbrella-subdomain plan works without it. The
  brand is the atlas, not the TLD.
- **Viral spike on day one**: handled by architecture — static + unlimited-bandwidth CDN;
  nothing to do.
- **Content controversy**: an atlas of war deaths will attract "your numbers are wrong /
  biased" threads. The defence is already built (uncertainty ranges, per-entry sources,
  About panel's coverage-bias essay); the feedback channel turns corrections into data PRs.
  Never argue a figure without a citation — update the YAML or decline with the source.
- **A single maintainer**: keep everything reproducible from the repo (already true), keep
  the pipeline documented (`docs/data.md`), archive raw inputs (P0-5).
