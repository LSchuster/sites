# Decisions and rationale

Why things are the way they are. Read this before changing an encoding or a colour — most of
these look arbitrary and are not.

## Honesty is the product

This is an atlas of how many people were killed. The design commitments that follow from that:

- **Every figure carries `{low, best, high, confidence}`** and the UI draws the uncertainty —
  crisp ring = documented, soft = estimated, dashed = disputed. A single confident number would
  be a lie for most of the last two thousand years.
- **Sparse centuries are drawn sparse.** Coverage reflects record-keeping, not violence. Never
  fill a gap with invented entries.
- **Disputed origins are stated in the summary.** Where a figure rests on a census collapse
  (An Lushan) or a demographic estimate rather than a body count (Congo Free State), the text
  says so.
- **No flag without a real modern successor.** See `docs/i18n-and-flags.md`.
- **`partOf` prevents double counting.** See `docs/data.md`.

If a change would make the site look more confident than the evidence is, it is the wrong change.

## The scale problem

WWII killed ~75,000,000. A medieval battle killed ~5,000. Across the dataset the spread is five
orders of magnitude. Three obvious encodings all fail:

- **Area-proportional** (`r ∝ √v`): WWII's radius is 55× the battle's — either the small
  conflicts are invisible or the large ones cover a continent.
- **Linear radius**: worse, 15,000×.
- **Log radius**: compresses honestly but destroys the *sense* of ratio; a war ten times deadlier
  looks marginally bigger, which misleads in the other direction.

What ships is a **damped power curve** on the value normalised against the largest conflict:
`r = R_MIN + (R_MAX - R_MIN) · (v/vMax)^0.42`. Compressed harder than area-proportional, but
still a power law — doubling the deaths multiplies the radius by the same factor anywhere on the
scale. The compression is real, so the legend says so out loud with nested calibration circles at
10k / 100k / 1M / 10M / 75M.

The legend uses **nested** circles sharing a baseline, not a row: the largest mark is 116 px
across and no row of five fits a 240 px panel. Labels are pushed apart to a minimum gap with
leader lines, because at the small end the circle tops are only pixels apart.

### Share of world population

The `Share of world` toggle re-ranks everything against the population of the time. It is the
fairer comparison across eras and the most striking thing the site does: the An Lushan Rebellion
may have killed one person in six alive on Earth, against roughly one in thirty for WWII. Deaths
are spread evenly across a conflict's duration — crude, but it avoids attributing a 160-year
war's entire toll to its first year.

## Colour

**Colour was validated against the actual dark map surface, not eyeballed.** The surface values
live in `MAP.oceanInner` / `MAP.oceanOuter` in `src/theme.ts`; re-run contrast and CVD checks
against whatever those are if you change them.

- **Territory tints are muted, cool, and assigned — not hashed.** This *reverses* an earlier
  decision. The first per-polity version hashed a hue from each name: busy, random, and colour
  spent on nothing. The single-tone version that replaced it read as a dashboard, not an atlas.
  The current answer (the 2026 atlas redesign) is the hand-tint range of a printed atlas:
  **seven low-chroma slots** (`TERRITORY` in `src/theme.ts`) at near-identical lightness, all
  cool or neutral, **assigned at build time** — adjacency-aware so neighbours differ, stable per
  entity across snapshots so France keeps its tint from 900 to 2010 (`pipeline/entities.ts`).
  The hue still carries no data, and deliberately cannot: it is separation, not encoding.
- **The warm end of the spectrum belongs to data.** Land tints are cool/neutral, ocean is deep
  navy; conflict marks and the belligerent wash own amber/red. That figure-ground split is why
  the bubbles read instantly at any zoom, and it is the constraint every TERRITORY slot was
  chosen under.
- **Uncertainty is drawn as uncertainty.** Boundaries whose either side carries the source's own
  `precision ≥ 3` rating render softer, and dashed once zoomed — the medieval steppe is not
  given the same crisp line as the 1920 Rhine. The rating ships as the `p` property; nothing is
  sharpened.
- **Labels are letterspaced serif capitals with anchors computed, not guessed.** The pole of
  inaccessibility of each polity's largest part, computed in projected space at build time —
  what a human engraver would pick as "the widest open ground".
- **Magnitude is a sequential ramp** (one hue, monotonic lightness, every step ≥3:1 on the
  surface). Size already encodes magnitude; the redundancy is deliberate.
- **Opposing sides use the diverging pair** blue↔red — two poles that read as opposition, not two
  categorical hues. Worst-pair CVD ΔE 19.2 on this surface.
- **Conflict *type* is never bubble hue.** Bubbles are an all-pairs form capped at three
  categorical slots and there are seven types. Type lives in the panel and the filter row.
- **Occupation is a deeper step of the belligerent amber, not a new hue.** Polities held by an
  enemy belligerent (`MAP.occupied`, the `MAGNITUDE[1]` tone at higher alpha) wash darker than
  polities merely at war. Occupation is a conflict intensity, so it stays inside the validated
  amber family rather than claiming a categorical colour — and German-held France must not read
  like fighting France, which one uniform wash made it do.

## Curated wartime borders (1939–1944)

The border source jumps from 1938 straight to 1945, so the deadliest conflict in the atlas had
no map: 1944 showed interwar Poland and no Reich. The six war years are **hand-curated
transforms of the 1938 base** (`data/curated/borders/`, mechanism in `docs/data.md`) rather
than invented geometry:

- **Merge and rename only, never draw.** Annexed/directly administered territory dissolves into
  the Reich; occupied states keep their borders and are renamed `"X (Germany)"` with
  `subjectTo`, the upstream dataset's own occupation convention. No line that is not in the
  1938 source can appear — so there is no Vichy demarcation, no Eastern-Front line (the Reich
  stops at the 1938 Soviet border), no split of partitioned Poland in 1939–40, no Italian
  Social Republic. Stating the limitation beats faking precision the source does not have.
- **Snapshots describe their year's end**, matching upstream convention, and the non-linear
  crossfade in `src/data/borders.ts` still holds each map until close to the next snapshot's
  own year — so with 1-year gaps the war years blend continuously and anachronism is capped at
  a year.

## Opposed bars

The casualty panel is a population-pyramid: rows are casualty *categories* (military, civilian),
sides grow left and right from a spine on one shared scale. That allows both comparisons — left
vs right, and row vs row — and the second is usually the story. WWII reads 16M vs 8.5M military
but 36M vs 4.5M civilian.

The whisker under each bar is the low–high range, which is the entire reason ranges are carried
through the data model: a war whose estimates vary threefold looks visibly different from one
pinned to ±5%.

## Map projection

**Equal Earth** — equal-area. On a map whose whole subject is *how big things were*, an
area-distorting projection like Mercator would inflate a bubble over Central Africa and undermine
the data.

## Timeline

The axis is **linear** 0–2026. It buries the modern era in 6% of the width, which is annoying, and
warping it would make the density of marks lie. Era jump-buttons solve navigation instead.

The stream graph behind the scrubber is **square-root scaled** and labelled as such — linear would
render eighteen centuries as a flat line against the 20th, and log is genuinely misleading for an
area mark. It is a navigation aid; exact magnitudes come from the panel.

A marker at **1989** annotates where UCDP event-level data begins, because the map visibly floods
there. That turns a jarring density jump into a caption about record-keeping.

## Stack and licence

Static build, no server, no runtime keys — the expensive work happens once in `pipeline/`.
Relative `base` in `vite.config.ts` so it deploys to a subdirectory (GitHub Pages project sites)
without configuration.

**GPL-3.0 is not a preference.** The historical border data is GPL-3.0 upstream and is
redistributed in `public/data/borders/`. Swapping it for Natural Earth (public domain) would
remove the obligation at the cost of the morphing borders. Do not relicense while that data ships.
