# Marketing plan — how conflicts.io gets traffic

Status: **plan** · Written 2026-08-07 · Part of the ops docs set (`publication-plan.md` is
the index). Execution tasks are the MK-* entries in `implementation-roadmap.md`. Traffic
numbers below are order-of-magnitude expectations from typical outcomes for comparable
projects, not promises.

---

## What we are marketing (positioning)

Not "a website about wars". The marketable object is: **"scrub through 2,000 years of
history and watch borders morph while conflicts rise and fade — with the uncertainty drawn
instead of hidden."** Three hooks, for three different audiences:

1. **The spectacle** — morphing borders, the An Lushan reveal, the 1989 UCDP flood.
   Audience: everyone. Format: video/GIF/screenshot.
2. **The craft** — 60 fps canvas, static architecture, a data pipeline that turns 239 MB
   into 271 KB, the four documented traps. Audience: developers, data-viz people.
   Format: Show HN, write-ups.
3. **The honesty** — casualty *ranges* rendered as uncertainty, `partOf` double-count
   protection, the coverage-bias essay. Audience: historians, teachers, journalists.
   Format: methodology content, citations.

Every channel below leans on one of these three. Never market with a fourth hook —
shock/body-count clickbait — see § What not to do.

## The three traffic modes

This is a spiky reference product (see `commercialization-plan.md` § Ground truths), so
marketing has three distinct jobs:

| Mode | What it is | Examples | Job |
|---|---|---|---|
| **Engineered spikes** | One-off posts to large communities | Show HN, r/dataisbeautiful, newsletters | Awareness bursts, backlinks, the donation/poster moments |
| **Compounding assets** | Things that keep pulling traffic without repeat effort | SEO conflict pages, YouTube timelapses, edu link lists, Wikipedia-worthy citability | The long-term baseline |
| **Cadence** | Small repeatable posts | "Year spotlight" on Bluesky/Mastodon, anniversary posts | Keeps the account alive between spikes, feeds the algorithm before big posts |

Expectation setting: one successful HN front page ≈ 20–60k visits over 2–3 days; a top
r/dataisbeautiful or r/InternetIsBeautiful post ≈ 10–100k; a viral border-timelapse short
is unbounded (the "history of Europe every year" video genre has individual videos with
tens of millions of views). Between spikes, without SEO pages, expect a quiet 50–200
visits/day. The compounding assets are what raise that floor.

## Channel-by-channel analysis

Scored: **Fit** (does the content belong there), **Ceiling** (best realistic outcome),
**Effort**, and how to play it.

### Tier 1 — launch window (highest certainty, do first)

**Hacker News (Show HN)** · Fit: excellent (hook 2) · Ceiling: 20–60k visits + lasting
dev-world backlinks · Effort: low, but timing-sensitive.
"Show HN: An interactive atlas of human conflict, year 0 to now" — the technical story in
the first comment: static site, no server, pipeline, canvas performance, uncertainty
rendering. Post a weekday morning US Eastern. Be present the first two hours; the top
comment thread will be about data validity — the About panel's coverage-bias and `partOf`
essays are the prepared answers, link them directly. One retry is acceptable if it doesn't
catch (HN tolerates a repost after ~a week). A second HN shot exists later via a technical
blog post (see Tier 2).

**r/InternetIsBeautiful** · Fit: near-perfect (the sub exists for exactly this) · Ceiling:
20–50k · Effort: minimal. One link post, plain descriptive title. Read the self-promo
rules (typically fine for free, no-login sites — which this is).

**r/dataisbeautiful [OC]** · Fit: excellent (hook 1) · Ceiling: 10–100k · Effort: low.
Lead with a *static image* (the sub favours images) — e.g. the deaths-per-year stream
across two millennia with An Lushan and WWII labelled — and the site link + methodology in
the comment. [OC] tag requires posting the tool/source; GPL repo satisfies it perfectly.

**r/MapPorn** · Fit: strong (hook 1) · Ceiling: 5–50k · Effort: minimal. A single
beautiful frame (Europe 1942, or Rome year 117) with the site in comments. Different week
than the dataisbeautiful post — staggering posts across subs over 3–4 weeks beats one
simultaneous blast (each sub's crosspost fatigue is real).

**German wave: r/de + German media pitches** · Fit: strong and underused — the site is
*fully bilingual*, which almost no comparable project is · Ceiling: 5–30k + chance of a
Zeit/SPIEGEL/FAZ data-team pickup · Effort: low-medium.
r/de link post in German; direct short pitches to German data-journalism desks (Zeit
Online, SPIEGEL, FAZ, SZ — they cover interactive history tools and the German
localization removes their main objection). Piqd (German curation platform) submission.
Run this as a second wave ~2 weeks after the English launch so there's social proof to
point at.

**Newsletter submissions** · Fit: excellent · Ceiling: 2–15k each, high-quality audiences
· Effort: minimal (one email each).
Data Is Plural (the *dataset* angle — the unified conflicts/battles/borders data is itself
a story), FlowingData (takes submissions), Kottke and Waxy (long history of linking
exactly this kind of project), Web Curios, Dense Discovery. One short personal email per
outlet, one screenshot, the link.

### Tier 2 — first quarter after launch (medium effort, high ceiling)

**Short-form video: the border timelapse** · Fit: outstanding (hook 1 in its purest form)
· Ceiling: **the highest of any channel** — this format is proven viral · Effort: medium.
"2,000 years of borders and wars in 60 seconds" as YouTube Shorts / TikTok / Reels:
screen-capture the playback (OBS is enough to start; MK-3 covers producing 3–5 clips —
whole world, Europe only, China only, the 20th century). Watermark the site URL in-frame
(the atlas aesthetic *is* the brand). Two paths, run both:
1. Own clips posted to own accounts — slow build, full control.
2. **Arm other creators**: a press-kit page with downloadable clips + "free to use with
   attribution" (GPL already permits it; making it *easy* and *invited* is the marketing
   move). The history-shorts creator ecosystem constantly needs exactly this footage, and
   every use is an ad.

**Bluesky + Mastodon cadence** · Fit: strong — the data-viz and history communities
(#histodons) concentrate there now · Ceiling: slow compounding, occasional 1–5k spikes ·
Effort: low if systematized. One "year spotlight" post per week (a screenshot, two
sentences of the story, deep link via P2-1 permalinks — this is why permalinks are
marketing infrastructure). Anniversaries make the calendar write itself (§ flywheel).

**Technical write-up → second HN/lobste.rs shot** · Fit: excellent · Ceiling: 10–40k +
durable dev credibility · Effort: medium. One long post: "Rendering 2,000 years of war at
60 fps with no server" — the four traps from the README are already the outline. Publish
anywhere linkable (GitHub repo docs works; a blog page on the site is better). Dev.to
cross-post free.

**#30DayMapChallenge (November)** · Fit: excellent — the cartography community's annual
hashtag event · Ceiling: strong niche visibility, follows, backlinks · Effort: low-medium
(the atlas can supply a map for half the daily prompts). Confirm the 2026 edition runs;
schedule ~10 posts, not all 30.

**Information is Beautiful Awards** · Fit: genuine contender (hook 1 + 3; the uncertainty
rendering is exactly what judges reward) · Ceiling: shortlist = press + permanent
credibility line · Effort: an evening. Check the current cycle's deadline and enter.

### Tier 3 — compounding infrastructure (slower, raises the floor)

**SEO: per-conflict pages (roadmap G-3, priority raised)** · Fit: the only real search
play · Ceiling: the difference between 100/day and 1,000+/day baseline within a year ·
Effort: the largest build in this plan.
The atlas is a single-URL canvas app — invisible to search. But the search demand is real
and evergreen ("Thirty Years War deaths", "An Lushan rebellion casualties" — every one of
the 105 curated conflicts is a query family). Build-time prerendered static pages from
`conflicts.json` (cited figures, uncertainty ranges, further-reading — content that
already exists in the data layer) each deep-linking into the atlas. This was G-3
("only if search traffic matters") — **it matters; treat it as the first post-release
growth project after M1/M2.** It also multiplies the affiliate shelf (M2) surface.

**Education link lists (German first)** · Fit: strong, uniquely accessible to a bilingual
site · Ceiling: modest steady traffic, high-value backlinks, feeds the education
commercialization line · Effort: low, bureaucratic. Submit to German educational link
collections (Landesbildungsserver "Linktipps", segu-geschichte-style portals, teacher
forums), and English equivalents. These links persist for years and carry domain
authority. Also the honest route into classrooms — which is the M4 education market
warming itself up.

**Wikipedia — citability, not spam** · Fit: careful · Ceiling: permanent trickle ·
Effort: restraint. **Do not add links to articles yourself** — conflict-of-interest
self-promotion gets reverted and damages reputation. Instead: make the atlas *worth
citing* (P1-5 cite-this blurb, stable permalinks, versioned data), and optionally one
transparent post on WikiProject Military History's talk page disclosing the resource
exists. Editors decide. Organic wiki links are a top-tier durable channel precisely
because they can't be bought.

**Newsroom relationships / The Pudding-style collaboration** · Fit: strong (hook 3) ·
Ceiling: one big feature ≈ 50k+ and institutional credibility · Effort: high, slow.
Pitch one co-produced essay (The Pudding accepts pitches; German: Zeit Online's data
team). This is also the funnel for the M4 embed product — a newsroom that used the atlas
once is the inbound interest M4 waits for. Sequence after permalinks + at least one viral
proof point.

**Podcasts (history mid-tier)** · Fit: decent (hook 3) · Ceiling: 1–10k per appearance ·
Effort: medium per shot. Not a launch channel; revisit when there's a story to tell
("what building this taught me about how war is recorded").

### Evaluated and rejected

- **Paid ads (Google/Meta):** no revenue model to justify acquisition cost, and the
  audience is reached free through the channels above. Never at this stage.
- **Product Hunt:** wrong audience shape (SaaS-tool hunters); the effort is better spent
  on r/InternetIsBeautiful. Acceptable as a zero-effort afterthought, nothing more.
- **Facebook/Instagram feed presence:** cadence cost without a community that shares this
  content. (Reels via the video clips is covered by short-form above.)
- **Engagement-bait formats** ("Top 10 deadliest wars ranked!"): traffic that poisons the
  brand with the exact audiences (teachers, journalists, historians) the strategy needs.

## The content flywheel

The curated data is a content mine — nothing needs inventing, only surfacing:

- **105 conflicts** = 105 potential year-spotlight posts, each with a map frame, a
  casualty-uncertainty story, and (post-M2) a reading list.
- **Anniversary calendar:** map each curated conflict's start/end dates onto the year;
  pre-write the obvious ones (e.g. armistice days, treaty anniversaries). One glance each
  Monday fills the week's cadence slot.
- **Every dataset refresh** (annual UCDP bump, new curated conflicts, new border
  snapshots) = a "what's new in the atlas" post + newsletter item.
- **Every technical improvement** = dev-channel material.

Rule of thumb for a solo operator: **~2 h/week** — one cadence post weekly, one Tier-1/2
action monthly. The launch month is the exception (plan a focused week).

## Launch playbook (sequenced)

Prerequisites: P1-2 (unfurls — nothing gets posted anywhere before link previews work),
P2-1 (permalinks — every post deep-links), MK-1 (press kit).

1. **Week 0 — soft proof:** post to one mid-size community (e.g. Mastodon #histodons +
   a data-viz Discord) to shake out surprises under mild load.
2. **Week 1 — English wave:** Show HN (Tuesday–Thursday morning ET). Two days later:
   r/InternetIsBeautiful. Newsletter emails the same week (they have lead time).
3. **Week 2–3 — image wave:** r/dataisbeautiful [OC], then r/MapPorn with a different
   frame. Cadence posting starts and never stops.
4. **Week 3–4 — German wave:** r/de, Piqd, German press pitches (with English-wave
   numbers as social proof).
5. **Month 2–3:** video clips + creator press kit live; technical write-up → second HN
   shot; IIB Awards entry when the cycle opens.
6. **November 2026:** #30DayMapChallenge.
7. **Ongoing:** education link-list submissions in the background; newsroom pitch once
   there's one viral proof point.

## Measurement (within the cookie-less constraint)

Cloudflare Web Analytics (P1-6) gives referrers and country split without cookies — enough
to attribute spikes to channels. Add nothing heavier. Review monthly against three
numbers: baseline visits/day (the floor the compounding assets should raise), spike count
and source, and donation/affiliate conversions per spike (ties into
`commercialization-plan.md` thresholds). Kill channels that show nothing after three
honest attempts; double down where the referrer data says the audience actually is.

## What not to do (taste rules, restated for marketing)

From `commercialization-plan.md` § Ground truths, applied to promotion: no body-count
clickbait, no ranking human tragedy for engagement, no newsjacking *ongoing* wars for
traffic (if journalists come during a news cycle, answer soberly — that is different from
chasing it), no Wikipedia self-linking, no fake-organic astroturfing in subreddits. The
project's credibility with teachers, historians and journalists is the compounding asset
every other channel feeds on; one cheap viral stunt can spend it permanently.
