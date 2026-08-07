# Data

Everything under `public/data/` is generated. Sources of truth:

| What | Where |
|---|---|
| Conflicts | `data/curated/*.yaml` (hand-written, era-split) |
| Translations | `data/curated/i18n/<locale>.yaml` |
| Everything else | fetched and transformed by `pipeline/*.ts` |

Raw downloads cache in `data/raw/` (gitignored), so re-running a pipeline step is cheap.

## The model

`src/types.ts` is the contract. The shape that matters:

```ts
interface Conflict {
  id, name, startYear, endYear
  centroid: [lon, lat]      // where the bubble sits
  extent?: number           // theatre radius in degrees — the faint outer ring
  sides: Side[]             // 2+; [0] and [1] become the opposed bars
  total: CasualtyRange
  type, region, summary, sources   // ≥1 source enforced by the validator
  partOf?: string           // see "Double counting"
  i18n?: Record<locale, ConflictTranslation>
}

interface CasualtyRange { low, best, high, confidence }
```

**Every figure is a range.** `confidence` is `documented | estimated | disputed` and drives the
bubble's ring style — crisp, soft, or dashed. Reducing a figure to a bare number destroys the
thing this project is actually for.

Sides model belligerents. Many entries use a third side for "Civilian population"; the panel
renders sides 0 and 1 as opposed bars and any extra as plain bars beneath.

### Double counting

The Holocaust and the Second Sino-Japanese War sit *inside* the 70–85M usually quoted for WWII.
They are separate entries because they matter separately, and carry `partOf: world-war-ii`.
**Anything that sums deaths must skip entries with `partOf`** or it double-counts tens of
millions of people. See `deathsPerYear` in `src/timeline/stream.ts` and the totals in
`pipeline/6-compile-conflicts.ts`.

## Editing conflicts

Edit the YAML, never the JSON:

```bash
npm run data:conflicts && npm run data:validate
```

YAML rather than JSON on purpose: a contested figure needs a comment next to it explaining why
that number was chosen, and diffs stay readable.

`pipeline/7-validate.ts` catches what silently renders fine but is wrong: `endYear < startYear`,
`low > best > high`, coordinates out of range, a centroid at exactly 0,0 (Gulf of Guinea — almost
always a forgotten placeholder), missing sources, duplicate ids, `partOf` pointing at nothing, and
per-side figures summing past the stated total. **It has caught real errors. Run it.**

## Pipelines

| Script | Output | Notes |
|---|---|---|
| `2-build-borders.ts` | `borders/*.topo.json` | 44.6 MB → ~2.5 MB gzipped; runs the entities pass |
| `3-wikidata-battles.ts` | `battles.json` + `battles.names.<locale>.json` | SPARQL, chunked by century — the endpoint times out on the full range; localized labels ride the same queries |
| `4-ucdp-aggregate.ts` | `ged/*.bin` | 239 MB CSV → 271 KB gzipped |
| `5-flags.ts` | `flags/` | see `docs/i18n-and-flags.md` |
| `6-compile-conflicts.ts` | `conflicts.json` | merges translations, reports coverage |
| `7-validate.ts` | — | invariants (conflicts *and* borders); fails the build |
| `8-terrain.ts` | `terrain/relief.webp` | Natural Earth shaded relief (public domain), pre-projected to Equal Earth |

### Borders

Simplification order is load-bearing: `topology` → `presimplify` → `simplify` → **`quantize`**.
`presimplify` discards the quantization transform and expands arcs to absolute floats, so
quantizing first is wasted work — nearly all the size reduction comes from quantizing *last*.
The script binary-searches the simplification threshold to a byte budget, with a `MIN_DETAIL`
floor so dense snapshots (1492 has 1,946 features) are allowed to run over rather than
simplifying into unrecognisable shapes.

At load, `src/data/borders.ts` extracts three TopoJSON meshes — `internal` (confident borders
between polities), `internalUncertain` (either side rated `precision ≥ 3` by the source — drawn
softer and dashed), and `coast` (arcs used by only one feature). That is what lets the coastline
be drawn brighter than internal borders, which is what makes continents read as land. It is also
a handful of path operations instead of ~750.

**The entities pass** (`pipeline/entities.ts`, phase B of the borders build) resolves which
features across the 43 snapshots are *the same polity*, then stamps four abbreviated properties
before slimming: `e` (stable entity id), `c` (territory tint slot 0–6), `l` (label anchor: pole
of inaccessibility of the largest part, computed in projected space via polylabel), `a`
(spherical area, millionths of a steradian). Identity tiers: exact canonical name (wartime
`" (X)"` suffix stripped) → the curated alias table `data/curated/borders/entity-aliases.yaml`
(successions like Siam→Thailand that share no token, plus a `never` list blocking false friends
like Britany↔Britain) → a fuzzy tier reusing `src/data/nameMatch.ts`, guarded twice: names that
ever co-occur in one snapshot are never merged (co-occurrence proves distinctness), and matches
with centroids more than 15° apart are rejected. Tints are assigned greedily over the entity
adjacency graph (built with `neighbors()` per snapshot), long-lived entities first — same-tint
neighbours measure ~0.2%. **Identity is visual continuity only** — tint stability, label fades,
selection persistence — never a historical claim; a wrong merge shows as a shared colour, never
as a changed border or name. Inspect `data/cache/entities-report.json` after a build; the
validator enforces one entity per name and one tint per entity across all snapshots.

**Terrain** (`8-terrain.ts`, `npm run data:terrain`): Natural Earth `GRAY_50M_SR` (public
domain) reprojected in pure JS into a 2600px Equal Earth plate and encoded as *plate shading* —
translucent black below the land median, translucent white above, transparent where flat; the
runtime embosses it into land fills with one `source-atop` drawImage (see docs/rendering.md).
~250 KB webp, fetched lazily after first paint.

**Curated wartime snapshots.** Upstream jumps straight from `world_1938` to `world_1945` — the
Second World War had no map of its own, so 1944 rendered with interwar borders. The years
1939–1944 are therefore *transforms of the 1938 base*, specified in
`data/curated/borders/world_<year>.yaml` and applied by the pipeline before simplification.
Three operations exist:

- `merge` — dissolve features into a target polity (annexed / directly administered territory,
  e.g. Czechoslovakia and Poland into Germany). The dissolve goes through a throwaway
  `topology()` + `merge()` so shared arcs disappear; a plain MultiPolygon would keep the seams
  and the renderer's mesh would draw them in the bright coast style.
- `occupy` — keep the borders, rename to `"X (Y)"` and set `SUBJECTO` — the dataset's own
  convention (`Ethiopia (Italy)  [subject to: Italy]` in the 1938 base).
- `release` — undo a base-file occupation: strip the parenthetical, clear `SUBJECTO`.

Ops match by exact `NAME` and apply to **every** feature carrying it (1938 has two "Italy");
a name that matches nothing hard-fails the build — a typo must break loudly, not vanish.
Each spec stands alone against the 1938 base, so a liberation in a later year is simply the
absence of the occupation. What the specs *cannot* do is split features: there is no Vichy
line, no Eastern-Front line through the USSR interior, no partition of Italy — the Reich
extends to the 1938 Soviet border and no further east.

**Do not "normalise" antimeridian coordinates.** Antarctica, the USSR and Fiji legitimately span
-180..180. Shifting negative longitudes by +360 turns Antarctica's circumpolar ring into a
self-intersecting polygon that fills the entire globe. d3-geo already clips correctly.

### UCDP

Needs a manual download — the API is token-gated, the bulk zip is not. Fetch
[ged251-csv.zip](https://ucdp.uu.se/downloads/ged/ged251-csv.zip) (29 MB), extract to
`data/raw/ucdp/extracted/GEDEvent_v25_1.csv`, then `npm run data:ucdp`.

The CSV needs a real streaming parser, not line splitting: `source_headline` and
`source_original` are free text containing commas *and literal newlines* inside quoted fields.
Events are binned to 0.25° cells per year and written as decade-sharded `Int32Array`
(`year, lonIdx, latIdx, deaths`), loaded only once the timeline reaches 1989.

## Runtime tiers

Loaded lazily so someone exploring antiquity never pays for modern data:

| Tier | Loads when |
|---|---|
| `conflicts.json` | always |
| `borders/world_<year>` | the bracketing pair for the current year |
| `terrain/relief.webp` | after borders, on an idle callback — never the first-paint path |
| `battles.json` | zoom > 1.8 |
| `battles.names.<locale>.json` | zoom > 1.8 in a non-English locale — per-battle English fallback |
| `ged/<decade>.bin` | year ≥ 1989 |
| `flags/<code>.svg` | hover, one at a time |

## Coverage is uneven, and that is the point

13 geolocated battles for the 2nd century, 1,854 for the 19th, hundreds of thousands from 1989.
That reflects writing, archives and satellites arriving — not violence increasing. **Draw sparse
centuries sparse. Do not fill them with invented entries.** The About panel says this to readers
in both languages; keep it true.
