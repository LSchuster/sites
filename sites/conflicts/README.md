# conflicts.io

An interactive atlas of human conflict from the year 0 to the present. Scrub a timeline and
watch political borders morph while wars appear on the map, sized by the number of people they
killed. Select any conflict to see how the casualties broke down between the sides, with the
uncertainty in those figures drawn rather than hidden.

Entirely static — no server, no database, no API keys, no tracking. It builds to plain
HTML/JS/CSS and deploys free to GitHub Pages, Cloudflare Pages or Netlify.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
```

The processed data in `public/data/` is committed, so `npm run dev` works immediately after
clone. You only need the pipeline below if you want to refresh or extend the data.

> **Working on this with an AI agent?** `CLAUDE.md` is the entry point — it carries the hard
> rules, the traps that have already cost debugging time, and a routing table to the deep dives
> in `docs/`. It is loaded automatically; the `docs/` files are read on demand.

## How it is put together

Two halves that never touch at runtime:

- **`pipeline/`** — Node scripts that run during development only. They fetch the raw sources,
  clean and aggregate them, and emit static files into `public/data/`.
- **`src/`** — the shipped app. It reads pre-baked files and nothing else.

That split is what keeps hosting free: the expensive work (parsing a 239 MB CSV, simplifying
37 world maps) happens once on a developer's machine, never in a browser.

```
data/curated/*.yaml      hand-written conflict records — the source of truth
pipeline/                fetch → clean → aggregate → public/data/
public/data/             committed build output, served as static files
src/map/                 canvas renderer, projection, scales, layers
src/panel/               conflict detail, opposed casualty bars
src/timeline/            scrubber and the deaths-per-year stream
tools/shot.mjs           CDP screenshot driver (see "Verifying" below)
```

## Data pipeline

```bash
npm run data:borders     # 37 world border snapshots → simplified TopoJSON
npm run data:battles     # ~6,500 geolocated battles from Wikidata (SPARQL)
npm run data:conflicts    # curated YAML → conflicts.json
npm run data:validate    # invariant checks — run this after any data edit
npm run data:ucdp        # UCDP GED aggregation (needs a manual download, below)
```

`data:ucdp` expects `data/raw/ucdp/extracted/GEDEvent_v25_1.csv`. Download
[ged251-csv.zip](https://ucdp.uu.se/downloads/ged/ged251-csv.zip) (29 MB) and extract it there.
Everything else fetches automatically and caches under `data/raw/` (gitignored).

What the pipeline achieves, in round numbers:

| Source | Raw | Shipped (gzipped) |
|---|---|---|
| Border snapshots | 44.6 MB | 2.1 MB |
| UCDP events | 239 MB | 271 KB |
| Wikidata battles | — | 90 KB |
| Curated conflicts | — | ~55 KB |

## Editing the conflict data

`data/curated/*.yaml` is the source of truth; `public/data/conflicts.json` is generated — never
edit it by hand. YAML is used so the reasoning behind a contested figure can live in a comment
next to it.

Every casualty figure is a `{ low, best, high, confidence }` range, and the UI renders that
uncertainty. After editing, always run:

```bash
npm run data:conflicts && npm run data:validate
```

`data:validate` catches transposed coordinates, ranges where `low > best`, missing sources,
duplicate ids, per-side figures that exceed the stated total, and translations whose side
count no longer matches the English record — mistakes that otherwise render as a
plausible-looking map that is simply wrong.

### `partOf`

Some conflicts are already counted inside a larger one — the Holocaust and the Second
Sino-Japanese War both sit within the 70–85 million usually quoted for the Second World War.
Those entries carry `partOf: world-war-ii`, and anything that sums deaths skips them. Without
it, the timeline would double-count tens of millions of people.

## Languages

English and German ship today. The UI, the About page, number formatting and the
conflict records themselves are all localized.

**Adding a language is two steps:**

1. Create `src/i18n/locales/<code>.ts` exporting a `Messages` object.
2. Register it in `LOCALES` in `src/i18n/index.ts`.

That is all — the switcher, detection and persistence pick it up automatically. The
`Messages` interface in `src/i18n/types.ts` is a typed nested object rather than a
`t('some.key')` lookup, so an incomplete translation **fails to compile** instead of
leaking `some.key` into the interface at runtime.

Locale is chosen from `localStorage`, then `navigator.languages` (matched on the
primary subtag, so `de-AT` gets German), then English.

### Translating the data

`data/curated/i18n/<locale>.yaml` maps conflict id → `{ name, region, sides, summary }`.
Belligerent member names are translated once, in the `data/curated/i18n/names.de.yaml`
dictionary, and baked into every conflict by the compile step; the same dictionary feeds
the German polity names on the map hover card. Every field is optional and falls back to
English individually, so a half-finished language shows translated titles above English
prose rather than blanks. The compile step reports coverage:

```
i18n/de.yaml                105 of 105 (100%)
```

Numbers are formatted through `Intl` with per-locale suffixes: English writes `75M`
and `3.1%`, German writes `75 Mio.` and `3,1 %`.

## Flags

`npm run data:flags` resolves polity names to ISO 3166-1 alpha-2 codes and copies just
the flags it needs out of `flag-icons` into `public/data/flags/` (174 files, ~1.6 MB,
fetched one at a time on hover at ~170 bytes gzipped each).

Two things worth knowing:

**SVG, not emoji.** Regional-indicator emoji (🇩🇪) are the obvious cheap answer and they
do not work: Windows ships no country-flag glyphs, so Chrome and Edge on Windows render
the letter pair "DE" in a box.

**Only ~7% of the 2,837 polity names get a flag, and that is correct.** Most names are
historical states with no modern successor ("Great Khanate") or ethnographic groupings
("Savanna hunter-gatherers"). A hand-written table in `pipeline/5-flags.ts` maps genuine
successors (Ottoman Empire → TR, Ceylon → LK), and a `BLOCKED` set refuses the ambiguous
ones — Prussia, Korea, Congo, Yugoslavia, the Holy Roman Empire. Showing a modern flag
for those would be an invention; no flag is the honest answer.

## Verifying

```bash
npm run build && npx serve dist       # confirm the static build works
node tools/shot.mjs http://localhost:5173/ shot.png 4500 1500 950
node tools/perf.mjs http://localhost:5173/
```

`tools/shot.mjs` drives headless Edge over the DevTools Protocol. Note the reason it exists:
Chromium's `--screenshot` flag needs `--virtual-time-budget` to wait for async work, and under
virtual time `requestAnimationFrame` never fires — so the canvas captures blank no matter how
long you wait. CDP runs the page on real time instead. It takes an optional `"x,y"` argument
(several separated by `;`) to click before capturing.

`tools/perf.mjs` reports frame timing for the four states that matter. Current numbers, headless
with **software** rendering (a real GPU does better):

| | fps | median | p95 |
|---|---|---|---|
| idle | 60 | 16.7 ms | 16.8 ms |
| playback 1× | 57 | 16.7 ms | 33.3 ms |
| panning | 60 | 16.7 ms | 16.8 ms |
| hover sweep | 60 | 16.7 ms | 16.7 ms |

Panning is the number to watch: it is the only interaction that can invalidate the cached
vector layers, and it regressed to 15 fps once already.

Worthwhile spot checks, because wrong data still looks fine:

- **year 9** — Teutoburg Forest appears in Germania (zoom in past level ~1.8 for battle marks)
- **year 117** — the Roman Empire at its greatest extent; **year 480** — the west is gone
- **year 208** — Red Cliffs, in China: confirmation the atlas is not Eurocentric
- **years 755–763** — An Lushan dominates; switch to *Share of world* and it dwarfs WWII
- **year 1988 → 1989** — the UCDP field appears, with its annotation on the timeline

## Deploying

`npm run build` emits `dist/`. Upload it anywhere. `vite.config.ts` uses a relative `base`, so
it works from a subdirectory (GitHub Pages project sites) without configuration.

## Licence and attribution

**GPL-3.0-or-later.** Not an arbitrary choice: the historical border data from
[aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) is GPL-3.0,
and it is redistributed here in `public/data/borders/`. Swapping it for Natural Earth
(public domain) would remove that obligation, at the cost of the morphing borders.

Other sources:

- **UCDP GED 25.1** — Uppsala Conflict Data Program, CC BY-4.0. Sundberg & Melander (2013),
  *Introducing the UCDP Georeferenced Event Dataset*, Journal of Peace Research 50(4).
- **Wikidata** — CC0.
- **Natural Earth** (`GRAY_50M_SR` shaded relief, basis of `public/data/terrain/`) — public
  domain.
- **World population** — McEvedy & Jones, HYDE, and UN estimates from 1950.
- **Curated conflict records** — compiled for this project; sources cited per entry.
- **EB Garamond** (display face, subset in `src/assets/fonts/`) — SIL Open Font License 1.1;
  the licence text ships alongside the fonts.

## Four traps in this codebase

Each of these was a real bug, each looked like something else, and each will come back if the
reasoning is lost. All three are commented at the site of the fix.

**Ring winding floods the globe.** GeoJSON's spherical interpretation treats ring orientation as
meaningful: a ring wound the wrong way describes the *complement* of the area you meant, so one
bad ring fills the entire map with a flat wash. The build pipeline's simplification collapses
small islands into inverted four-point rings — the 1914 United Kingdom is a MultiPolygon of 40
pieces and several of them measured 4π steradians, the whole sphere. `fixWinding` in
`src/data/borders.ts` repairs this **per polygon**; a per-feature version silently swaps the
broken pieces for the sound ones and changes nothing on screen.

**The year must stay fractional.** Playback advances the year by a fraction each frame. Rounding
it in the store snaps every increment back to the same integer and the animation sits perfectly
still while the loop runs at full speed. Round at the point of display only (`displayYear`).

**`dirty` means content, not viewport.** The renderer caches rasterised vector layers and blits
them with a delta transform while the user drags. Setting the `dirty` flag inside `setTransform`
forces a full re-raster every frame of a pan and drops it to 15 fps, while every other
interaction still measures 60 and hides the cause.

**`Intl.DisplayNames` still answers for dead ISO codes.** Building a name→code map by iterating
AA–ZZ looks clean and quietly mis-maps the biggest countries on the map: deprecated and reserved
codes sort *after* the live ones, so last-writer-wins sends "France" to **FX** (Metropolitan
France), "United Kingdom" to **UK** (reserved), "Russia" to **SU** and "Serbia" to **YU**. None of
those have a flag file, so the failure surfaces as "France has no flag" rather than as an error.
`displayNameMap` filters to codes that actually ship an asset and takes the first writer.

## A caveat worth repeating

The map shows what was *recorded*, not what happened. There are 13 geolocated battles on record
for the 2nd century and 1,854 for the 19th; from 1989 the map floods with hundreds of thousands
of events. That reflects the spread of writing, archives and satellites — not a change in human
behaviour. Sparse centuries are drawn sparse rather than filled with invented entries. The
in-app About panel says the same thing to readers.
