# Commercialization plan

Status: **plan, not yet implemented** · Written 2026-08-07 · Part of the ops docs set — see
`publication-plan.md` for the index. Task IDs (M1-*…M4-*) resolve in
`implementation-roadmap.md`. Nothing here is legal or tax advice; §Legal flags the two points
that need a professional before the first euro moves.

---

## Ground truths that shape every decision

**1. The licence defines the moat.** The code is GPL-3.0-or-later (forced by the
historical-basemaps border data, see `README.md` § Licence) and the processed data ships in a
public repo. Anyone may legally clone, rehost, and even sell this site. Therefore:

- **Feature-gating cannot work.** Any "premium feature" shipped to browsers is conveyed
  GPL code — a fork removes the gate in an afternoon. Do not build paywalled client features.
- What *cannot* be forked: the **domain and brand**, the **canonical hosted instance**, the
  **ongoing curation** (the value is that the data keeps improving), the operator's
  **credibility with the audience**, **physical goods**, and **relationships** (media,
  education). Every monetization idea below attaches to one of these, never to the code.
- Server-side code would not be conveyed (GPLv3 has no network clause), so a hypothetical
  backend could stay private — but no backend is planned or needed.

**2. The data licences permit commercial use.** UCDP GED 25.1 is CC BY 4.0 (attribution
required — already rendered in the About panel, keep it), Wikidata CC0, Natural Earth public
domain, EB Garamond OFL 1.1 (fine for commercial sites; not sellable *as a font*). No source
forbids earning money around the atlas. Re-verify licences on every dataset version bump.

**3. The subject is mass death.** This constrains taste, and taste constrains trust, and
trust is the entire asset with this audience (teachers, historians, journalists). Hard rules:

- The atlas, all data, and both languages stay free, forever. Never paywall a death toll.
- No ad networks. War content is brand-unsafe in both directions: advertisers blocklist it,
  and a programmatic ad for junk beside the Holocaust entry would be catastrophic for trust.
- No dark patterns, no interstitials, no "unlock" mechanics. Monetization is offered, never
  imposed.

**4. The traffic will be spiky, not recurring.** This is an occasional-deep-session
reference (like a museum visit), not a daily tool. Expect: viral spikes from HN/Reddit/
newsletters, then a long tail of search/education traffic. Models needing daily engagement
(subscriptions) or steady impressions (ads) fit badly; models that convert *moments* —
a moved visitor donating, buying a print, following a book link — fit well.

## Model-by-model evaluation

| Model | Verdict | Reasoning |
|---|---|---|
| **Donations** (Ko-fi + GitHub Sponsors) | **Yes — first** | Perfect cultural fit for an open scholarly tool; zero build cost (links in About/footer); no new data processing; no VAT complexity at donation scale. Yield is low but nonzero from day one. |
| **Affiliate further-reading** | **Yes — second** | Every conflict already cites sources in `data/curated/*.yaml`; a curated "further reading" shelf per conflict is *added product value* that happens to earn ~5–7% on books (Amazon PartnerNet DE; indie alternatives where available). Honest, on-topic, disclosure-compatible. |
| **One-time purchases: prints/posters + high-res export** | **Yes — third, after traffic proof** | The map is genuinely beautiful (EB Garamond, terrain, uncertainty-drawn cartography) — "Europe 1942" or "two millennia of conflict" as wall art is a real product. Canvas is same-origin/untainted (`src/map/grain.ts` already calls `toDataURL`), so high-res export is technically straightforward. Digital first via a merchant-of-record (handles EU VAT), print-on-demand later. The *export feature itself stays free* (GPL makes gating it pointless); the paid goods are curated, print-mastered posters and physical prints. |
| Sponsoring / patronage | Later, opportunistic | A single tasteful "supported by <museum/publisher/university>" line once the site has authority. Never programmatic. Requires traffic (~100k/mo) or institutional relationships. |
| Embeds for media (Datawrapper-style) | Explore later (M4) | Newsrooms pay for embeddable interactives. Technically small (embed mode + `frame-ancestors` change — see `hosting-architecture.md` § headers). But sales+support effort is real and GPL lets them self-host anyway; pursue only on inbound interest. |
| Education products | Later | The atlas stays free for classrooms (that *is* the growth loop). Sellable: teaching packs (worksheets/lesson plans as digital products), workshops, custom cartography for museums/publishers (consulting). Effort-heavy; only with demonstrated education uptake. |
| Subscriptions / freemium | **No** | No recurring job-to-be-done; GPL neuters feature gates. A Ko-fi *membership* (supporter tier with name-in-About credit) is fine — that is donations with a thank-you, not a product gate. |
| Advertising | **No** | Brand-unsafe content, spiky traffic, ~€1–3 RPM at best → €100–300/mo even at 100k pv, in exchange for a consent banner (breaking the cookie-less privacy stance), aesthetic damage, and trust damage. Revisit never, or at >500k pv/mo with a single vetted sponsor instead. |
| Paid API / data access | **No** | The dataset is already public in the repo (and must stay so); UCDP has its own free API. Charging for open data invites zero-cost competition. Instead: free versioned data releases with a citation request — feeds credibility, which feeds everything else. |

## Recommended path

**M1 — Donations (at public release).** Ko-fi + GitHub Sponsors links in the About panel and
footer, framed as "keep the atlas free and growing". Optional supporter credit list in About.
Cost: hours. Expected: €0–30/mo early on; spikes correlate with launch/viral moments.

**M2 — Further-reading shelves (1–2 months after release).** New optional `reading:` field in
curated YAML (title, author, year, ISBN/link, one-line why), compiled into `conflicts.json`,
rendered in the conflict panel with an "affiliate links" disclosure. Start with the 15–20
most-visited conflicts (analytics will say which). Cost: days (schema + pipeline + UI + i18n).
Expected: €10–100/mo at 30–50k pv/mo; also simply makes the product better.

**M3 — Export & posters (only after ~20k visits/mo sustained, or one big viral event).**
Free: "download this view as PNG" (attribution footer baked in, per CC BY). Paid: a small
shop of print-mastered posters (digital download via merchant-of-record first — Paddle or
Lemon Squeezy — physical print-on-demand via Gelato/Printful second). Cost: the export
renderer is the largest single build in this plan (offscreen re-render at 4–6×, fonts, labels);
shop setup is accounts + a page. Expected: near-zero in quiet months, €100–500 in spike
months if the product is good.

**M4 — Sponsorship / embeds / education (opportunistic, ≥6 months post-launch).** Pursue on
signal (inbound email, education uptake in analytics), not on schedule.

### What stays free — permanently

The full atlas, all interactions, both languages, all data, data downloads, the PNG export,
and the source code. The paid layer is only ever: voluntary support, curated physical/digital
goods, and institutional services.

### Traffic thresholds (honest numbers)

| Monthly visits | What is realistic |
|---|---|
| < 5k | Donations ≈ €0–10. Do nothing else; grow instead. |
| 5–30k | Donations €10–40; affiliate shelves start earning €10–50. Total ≈ covers costs ×5–10. |
| 30–100k | Affiliate €50–150; first poster sales if M3 shipped; sponsorship becomes pitchable. €100–300/mo territory. |
| Viral spike (HN front page ≈ 30–80k in days) | Donations + posters convert the *moment*: €100–500 one-off if M1/M3 are live before it happens. This is the argument for shipping M1 early. |

Costs to beat: ~€5/mo — and since the umbrella domain is shared by every site in the
monorepo (see `hosting-architecture.md` § Costs), this site's marginal cost is effectively
€0. Break-even is trivial;
meaningful income (>€500/mo) requires either sustained 100k+ visits or the education/media
lines — treat this project in year one as a reputation asset with a tip jar, and let the
data decide whether to push further.

## Technical additions required (all small, mapped to roadmap)

| Task | Scope |
|---|---|
| M1-1 | Two outbound links + supporter section in About, both locales. No new scripts, no tracking. |
| M2-1/M2-2 | YAML schema + `pipeline/6-compile-conflicts.ts` passthrough + `pipeline/7-validate.ts` checks; panel UI section + disclosure line, both locales. |
| M3-1 | Offscreen high-res renderer reusing `src/map/renderer.ts` layers; attribution footer; download button. Respect CLAUDE.md rule 4 (no React in the render path). |
| M3-2 | Static shop page + MoR checkout links; OG images per poster. No cart, no accounts, no server. |
| M4-* | Embed query param + relaxed `frame-ancestors` for an `/embed` variant; explicitly deferred. |

Nothing in M1–M3 adds cookies, accounts, or server components — the privacy posture and the
static architecture survive every recommended step.

## Legal, tax, privacy (Germany-specific)

- **Impressum** (§5 DDG) and **Datenschutzerklärung** (Art. 13 GDPR) are prerequisites for
  *any* of this — they are launch gates already (roadmap P1-4). Monetization removes any
  doubt about the Impressum obligation.
- **Trade registration**: affiliate income and sales = commercial activity ⇒
  **Gewerbeanmeldung** before M2 goes live (donations alone, for a project that also earns,
  count as business income too). One form, ~€20–60.
- **VAT**: Kleinunternehmerregelung (§19 UStG, ≤ €25k prior-year turnover under post-2025
  rules) will apply for the foreseeable future — no VAT on invoices, minimal bookkeeping.
  Using a **merchant-of-record** for digital posters (Paddle/Lemon Squeezy) sidesteps EU
  cross-border VAT entirely — they are the seller. **One hour with a Steuerberater before M2
  ships** — this doc is not tax advice.
- **Affiliate disclosure**: mark the shelf "Werbung / affiliate links" (§5a UWG); one static
  line in both locales, part of M2-2.
- **Privacy impact of each step**: M1/M2 are outbound links — zero new on-site processing;
  the privacy page gains one sentence about the external shops. M3 digital sales happen on
  the MoR's domain under their DPA. Analytics stays cookie-less throughout. No consent
  banner at any recommended stage.
- **Attribution obligations ride along**: exported PNGs and posters must carry the UCDP
  CC BY attribution + basemap credit in the rendered footer (M3-1 acceptance criterion, not
  an afterthought).

## Order of introduction (summary)

1. Launch free with donations visible (M1) — before any viral moment, not after.
2. Add further-reading shelves (M2) once analytics shows which conflicts people dwell on —
   also the moment for Gewerbeanmeldung + tax consult.
3. Build export + posters (M3) only after sustained traffic or a proven spike.
4. Everything else (sponsors, embeds, education) on inbound signal only.
5. Ads: no.
